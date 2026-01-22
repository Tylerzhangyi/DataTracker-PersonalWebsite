const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const UAParser = require('ua-parser-js');

const app = express();
const PORT = process.env.PORT || 5555;
const ALLOWED_SITE = process.env.ALLOWED_SITE || 'tyler.yunguhs.com';

// 数据库路径
const dbPath = path.join(__dirname, 'tracker.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('打开数据库失败:', err);
    process.exit(1);
  }
  console.log('已连接到数据库:', dbPath);
});

// 将 sqlite3 的回调 API 包装为 Promise
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 中间件 - CORS 配置（允许本地开发）
app.use(cors({
  origin: true, // 允许所有来源（本地开发）
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '../dashboard')));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.body) {
    console.log('  Body:', JSON.stringify(req.body).slice(0, 200));
  }
  next();
});

// 简单的 IP hash（隐私友好）
function hashIp(ip) {
  if (!ip) return '';
  // 简单 hash，只保留前 16 个字符
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// POST /collect - 接收追踪事件
app.post('/collect', async (req, res) => {
  try {
    const body = req.body;
    const ip = req.ip || req.connection?.remoteAddress || '';
    const ua = req.get('user-agent') || '';
    
    console.log('📥 收到事件请求:', {
      site: body.site,
      type: body.type,
      ts: body.ts,
      ip: ip ? ip.substring(0, 20) + '...' : 'unknown',
      origin: req.get('origin') || 'none'
    });

    // 简单验证
    if (!body.site || !body.type || !body.ts) {
      console.log('❌ 验证失败: 缺少必要字段');
      return res.status(400).json({ ok: false, error: 'missing fields' });
    }

    // 可选：站点白名单检查
    if (ALLOWED_SITE && body.site !== ALLOWED_SITE) {
      return res.status(403).json({ ok: false, error: 'site not allowed' });
    }

    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ipHash = hashIp(ip);

    await dbRun(
      `INSERT INTO events (id, site, ts, type, session_id, visitor_id, url, path, referrer, ua, ip_hash, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.site,
        body.ts,
        body.type,
        body.session_id || null,
        body.visitor_id || null,
        body.url || null,
        body.path || null,
        body.referrer || null,
        ua,
        ipHash,
        JSON.stringify(body.data || {}),
      ]
    );

    console.log(`✅ 事件已保存: ${body.type} from ${body.site} at ${new Date(body.ts).toLocaleString()}`);
    res.json({ ok: true, id });
  } catch (err) {
    console.error('收集事件失败:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 解析 User-Agent 获取设备信息
function parseDevice(ua) {
  if (!ua) return { device: 'Unknown', os: 'Unknown', browser: 'Unknown' };
  const parser = new UAParser(ua);
  const device = parser.getDevice();
  const os = parser.getOS();
  const browser = parser.getBrowser();
  
  return {
    device: device.model || device.type || 'Desktop',
    deviceType: device.type || 'desktop',
    os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
    browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
  };
}

// 构建桑基图数据（支持可配置的层）
function buildSankeyData(pageviews, layers = ['os', 'browser', 'referrer', 'deviceType', 'path']) {
  // 支持的层类型
  const layerTypes = {
    referrer: (pv) => pv.referrer || '直接访问',
    deviceType: (pv) => {
      const deviceInfo = parseDevice(pv.ua);
      return deviceInfo.deviceType || 'desktop';
    },
    os: (pv) => {
      const deviceInfo = parseDevice(pv.ua);
      return deviceInfo.os || 'Unknown';
    },
    browser: (pv) => {
      const deviceInfo = parseDevice(pv.ua);
      return deviceInfo.browser.split(' ')[0] || 'Unknown'; // 只取浏览器名称，不要版本号
    },
    path: (pv) => pv.path || '/',
  };
  
  // 验证层配置
  const validLayers = layers.filter(layer => layerTypes.hasOwnProperty(layer));
  if (validLayers.length === 0) {
    validLayers.push('os', 'browser', 'referrer', 'deviceType', 'path'); // 默认配置
  }
  
  // 收集所有节点
  const nodeSets = {};
  validLayers.forEach(layer => {
    nodeSets[layer] = new Set();
  });
  
  // 统计每个层的节点
  pageviews.forEach(pv => {
    validLayers.forEach(layer => {
      const value = layerTypes[layer](pv);
      nodeSets[layer].add(value);
    });
  });
  
  // 构建节点映射
  const nodeLabels = [];
  const nodeMap = new Map();
  const layerNodeRanges = {}; // 记录每层节点的索引范围
  let nodeIndex = 0;
  
  validLayers.forEach((layer, layerIdx) => {
    const startIdx = nodeIndex;
    nodeSets[layer].forEach(value => {
      if (!nodeMap.has(value)) {
        nodeMap.set(value, nodeIndex);
        nodeLabels.push(value);
        nodeIndex++;
      }
    });
    layerNodeRanges[layer] = { start: startIdx, end: nodeIndex };
  });
  
  // 构建连接
  const linkMap = new Map();
  
  pageviews.forEach(pv => {
    const values = validLayers.map(layer => layerTypes[layer](pv));
    
    // 连接相邻的层
    for (let i = 0; i < values.length - 1; i++) {
      const source = values[i];
      const target = values[i + 1];
      const linkKey = `${source}→${target}`;
      linkMap.set(linkKey, (linkMap.get(linkKey) || 0) + 1);
    }
  });
  
  // 构建 links 数组
  const links = [];
  linkMap.forEach((value, key) => {
    const [source, target] = key.split('→');
    if (nodeMap.has(source) && nodeMap.has(target)) {
      links.push({
        source: nodeMap.get(source),
        target: nodeMap.get(target),
        value: value
      });
    }
  });
  
  return {
    nodes: nodeLabels.map(label => ({ label })),
    links: links,
    layers: validLayers // 返回使用的层配置
  };
}

// GET /stats - 获取统计数据
app.get('/stats', async (req, res) => {
  try {
    const site = req.query.site || ALLOWED_SITE;
    const sinceMin = parseInt(req.query.sinceMin || '43200', 10); // 默认30天
    const sinceTs = Date.now() - sinceMin * 60 * 1000;

    // PV（pageview 数量）
    const pvRow = await dbGet(
      `SELECT COUNT(*) as count FROM events
       WHERE site = ? AND type = 'pageview' AND ts >= ?`,
      [site, sinceTs]
    );
    const pv = pvRow?.count || 0;

    // UV（独立访客数，基于 visitor_id）
    const uvRow = await dbGet(
      `SELECT COUNT(DISTINCT visitor_id) as count FROM events
       WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL`,
      [site, sinceTs]
    );
    const uv = uvRow?.count || 0;

    // PV 趋势数据（按小时分组）
    const pvTrendRaw = await dbAll(
      `SELECT 
        strftime('%Y-%m-%d %H:00:00', ts/1000, 'unixepoch', 'localtime') as hour_key,
        COUNT(*) as count
       FROM events
       WHERE site = ? AND type = 'pageview' AND ts >= ?
       GROUP BY hour_key
       ORDER BY hour_key ASC`,
      [site, sinceTs]
    );
    
    const pvTrend = (pvTrendRaw || []).map(row => ({
      time: row.hour_key || '',
      count: row.count || 0
    }));

    // Top Pages（按 path 分组统计 pageview，包含标题）
    const topPagesRaw = await dbAll(
      `SELECT path, data, COUNT(*) as pv FROM events
       WHERE site = ? AND type = 'pageview' AND ts >= ? AND path IS NOT NULL
       GROUP BY path
       ORDER BY pv DESC
       LIMIT 20`,
      [site, sinceTs]
    );
    
    // 解析每个页面的标题
    const topPages = (topPagesRaw || []).map(row => {
      let title = '';
      try {
        const data = JSON.parse(row.data || '{}');
        title = data.title || '';
      } catch (e) {}
      return {
        path: row.path,
        title: title,
        pv: row.pv
      };
    });

    // 访客列表（visitor_id, 设备信息, 访问页面数, 首次/最后访问时间）
    const visitorsRaw = await dbAll(
      `SELECT 
        visitor_id,
        MIN(ts) as first_ts,
        MAX(ts) as last_ts,
        COUNT(DISTINCT path) as pages_count,
        COUNT(CASE WHEN type = 'pageview' THEN 1 END) as pv_count,
        MAX(ua) as ua
       FROM events
       WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL
       GROUP BY visitor_id
       ORDER BY last_ts DESC
       LIMIT 50`,
      [site, sinceTs]
    );
    
    const visitors = (visitorsRaw || []).map(v => {
      const deviceInfo = parseDevice(v.ua);
      return {
        visitor_id: v.visitor_id,
        device: deviceInfo.device,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
        firstVisit: v.first_ts,
        lastVisit: v.last_ts,
        pagesCount: v.pages_count,
        pvCount: v.pv_count || 0,
      };
    });

    // 设备统计（设备类型、操作系统、浏览器分布）
    const allPageviews = await dbAll(
      `SELECT ua FROM events
       WHERE site = ? AND type = 'pageview' AND ts >= ? AND ua IS NOT NULL`,
      [site, sinceTs]
    );
    
    const deviceStats = {
      deviceTypes: {},
      os: {},
      browsers: {},
    };
    
    allPageviews.forEach(row => {
      const info = parseDevice(row.ua);
      deviceStats.deviceTypes[info.deviceType] = (deviceStats.deviceTypes[info.deviceType] || 0) + 1;
      deviceStats.os[info.os] = (deviceStats.os[info.os] || 0) + 1;
      deviceStats.browsers[info.browser] = (deviceStats.browsers[info.browser] || 0) + 1;
    });

    // Recent Events（最近 50 条，包含标题）
    const recentRaw = await dbAll(
      `SELECT ts, type, path, data, visitor_id, ua FROM events
       WHERE site = ? AND ts >= ?
       ORDER BY ts DESC
       LIMIT 50`,
      [site, sinceTs]
    );
    
    const recent = (recentRaw || []).map(ev => {
      let dataObj = {};
      let title = '';
      try {
        dataObj = JSON.parse(ev.data || '{}');
        title = dataObj.title || '';
      } catch (e) {}
      
      const deviceInfo = parseDevice(ev.ua);
      
      return {
        ts: ev.ts,
        type: ev.type,
        path: ev.path,
        title: title,
        data: JSON.stringify(dataObj),
        visitor_id: ev.visitor_id,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
      };
    });

    // 桑基图数据：来源 → 页面，设备 → 页面
    const pageviewsForSankey = await dbAll(
      `SELECT referrer, path, ua FROM events
       WHERE site = ? AND type = 'pageview' AND ts >= ? AND path IS NOT NULL`,
      [site, sinceTs]
    );
    
    // 从查询参数获取层配置（默认：os,browser,referrer,deviceType,path）
    const layersParam = req.query.sankeyLayers || 'os,browser,referrer,deviceType,path';
    const layers = layersParam.split(',').map(l => l.trim()).filter(Boolean);
    
    // 构建桑基图数据
    const sankeyData = buildSankeyData(pageviewsForSankey, layers);

    // 新老用户统计
    // 新用户：在时间窗口内首次访问的用户（first_ts >= sinceTs）
    // 老用户：在时间窗口内访问，但首次访问在时间窗口之前的用户（first_ts < sinceTs）
    const newUserStats = await dbAll(
      `SELECT 
        visitor_id,
        MIN(ts) as first_ts,
        COUNT(CASE WHEN type = 'pageview' THEN 1 END) as pv_count
       FROM events
       WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL
       GROUP BY visitor_id`,
      [site, sinceTs]
    );
    
    let newUsers = 0;
    let returningUsers = 0;
    let newUserPV = 0;
    let returningUserPV = 0;
    
    newUserStats.forEach(stat => {
      if (stat.first_ts >= sinceTs) {
        // 新用户：首次访问在时间窗口内
        newUsers++;
        newUserPV += (stat.pv_count || 0);
      } else {
        // 老用户：首次访问在时间窗口之前
        returningUsers++;
        returningUserPV += (stat.pv_count || 0);
      }
    });
    
    const userStats = {
      newUsers: newUsers,
      returningUsers: returningUsers,
      newUserPV: newUserPV,
      returningUserPV: returningUserPV,
      totalUsers: newUsers + returningUsers,
      totalPV: newUserPV + returningUserPV
    };

    // 新老用户时间趋势数据（按小时分组）
    // 先获取所有访客的首次访问时间
    const visitorFirstVisit = await dbAll(
      `SELECT 
        visitor_id,
        MIN(ts) as first_ts
       FROM events
       WHERE site = ? AND visitor_id IS NOT NULL
       GROUP BY visitor_id`,
      [site]
    );
    
    const firstVisitMap = new Map();
    visitorFirstVisit.forEach(v => {
      firstVisitMap.set(v.visitor_id, v.first_ts);
    });

    // 按小时统计新老用户（去重每个小时的访客）
    const hourUserMap = new Map();
    const allEvents = await dbAll(
      `SELECT DISTINCT
        strftime('%Y-%m-%d %H:00:00', ts/1000, 'unixepoch', 'localtime') as hour_key,
        visitor_id
       FROM events
       WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL
       ORDER BY hour_key ASC`,
      [site, sinceTs]
    );

    allEvents.forEach(row => {
      const hour = row.hour_key;
      const vid = row.visitor_id;
      
      if (!hourUserMap.has(hour)) {
        hourUserMap.set(hour, { newUsers: new Set(), returningUsers: new Set() });
      }
      
      const firstTs = firstVisitMap.get(vid);
      if (firstTs && firstTs >= sinceTs) {
        hourUserMap.get(hour).newUsers.add(vid);
      } else if (firstTs) {
        hourUserMap.get(hour).returningUsers.add(vid);
      }
    });

    // 转换为数组格式
    const userTrend = Array.from(hourUserMap.entries())
      .map(([time, data]) => ({
        time: time,
        newUsers: data.newUsers.size,
        returningUsers: data.returningUsers.size,
        totalUsers: data.newUsers.size + data.returningUsers.size
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    res.json({
      ok: true,
      pv,
      uv,
      sinceMin,
      topPages: topPages || [],
      recent: recent || [],
      visitors: visitors || [],
      deviceStats: deviceStats,
      pvTrend: pvTrend || [],
      sankey: sankeyData,
      userStats: userStats,
      userTrend: userTrend || [],
    });
  } catch (err) {
    console.error('获取统计失败:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /tracker.js - 动态下发追踪脚本
app.get('/tracker.js', (req, res) => {
  const trackerPath = path.join(__dirname, '../tracker/tracker.js');
  const trackerCode = fs.readFileSync(trackerPath, 'utf8');

  // 替换默认的 ENDPOINT
  const defaultEndpoint = `${req.protocol}://${req.get('host')}/collect`;
  const modifiedCode = trackerCode.replace(
    /const ENDPOINT = .*?;/,
    `const ENDPOINT = "${defaultEndpoint}";`
  );

  res.setHeader('Content-Type', 'application/javascript');
  res.send(modifiedCode);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 网站追踪服务器已启动`);
  console.log(`   访问地址: http://localhost:${PORT}`);
  console.log(`   仪表盘: http://localhost:${PORT}/`);
  console.log(`   追踪脚本: http://localhost:${PORT}/tracker.js`);
  console.log(`   接收端点: http://localhost:${PORT}/collect`);
  console.log(`   允许站点: ${ALLOWED_SITE}\n`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭数据库连接...');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库失败:', err);
    } else {
      console.log('数据库已关闭');
    }
    process.exit(0);
  });
});
