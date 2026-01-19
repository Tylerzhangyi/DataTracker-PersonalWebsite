/**
 * Cloudflare Worker: website tracker
 * - POST /collect  接收埋点事件
 * - GET  /stats    简单聚合查询（PV/UV/Top pages/最近事件）
 * - GET  /tracker.js 动态返回埋点 SDK
 */

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function text(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "text/plain; charset=utf-8");
  return new Response(body, { ...init, headers });
}

function corsHeaders(req) {
  const origin = req.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
}

function isAllowedSite(env, site) {
  return !!site && site === env.ALLOWED_SITE;
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req) {
  // CF-Connecting-IP 在 Cloudflare 边缘可用
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

function nowMs() {
  return Date.now();
}

function clampStr(s, max) {
  if (typeof s !== "string") return "";
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function safeJsonStringify(obj, maxLen = 2000) {
  try {
    const s = JSON.stringify(obj ?? {});
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  } catch {
    return "{}";
  }
}

function uuid() {
  return crypto.randomUUID();
}

async function handleCollect(req, env) {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405, headers: cors });

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400, headers: cors });
  }

  const site = clampStr(body.site, 200);
  if (!isAllowedSite(env, site)) return json({ error: "site_not_allowed" }, { status: 403, headers: cors });

  const type = clampStr(body.type, 50);
  const ts = Number.isFinite(body.ts) ? Math.floor(body.ts) : nowMs();
  const sessionId = clampStr(body.session_id, 100);
  const visitorId = clampStr(body.visitor_id, 100);
  const url = clampStr(body.url, 2000);
  const path = clampStr(body.path, 1000);
  const referrer = clampStr(body.referrer, 2000);
  const ua = clampStr(req.headers.get("user-agent") || "", 400);

  const ip = getClientIp(req);
  const ipHash = ip ? (await sha256Hex(ip)).slice(0, 32) : "";
  const data = safeJsonStringify(body.data, 4000);

  if (!type) return json({ error: "missing_type" }, { status: 400, headers: cors });

  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO events (id, site, ts, type, session_id, visitor_id, url, path, referrer, ua, ip_hash, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, site, ts, type, sessionId, visitorId, url, path, referrer, ua, ipHash, data)
    .run();

  return json({ ok: true }, { headers: cors });
}

async function handleStats(req, env) {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, { status: 405, headers: cors });

  const url = new URL(req.url);
  const site = clampStr(url.searchParams.get("site") || "", 200);
  if (!isAllowedSite(env, site)) return json({ error: "site_not_allowed" }, { status: 403, headers: cors });

  const sinceMin = Math.max(5, Math.min(60 * 24 * 30, Number(url.searchParams.get("sinceMin") || "1440"))); // 默认 24h，最多 30d
  const sinceTs = nowMs() - sinceMin * 60 * 1000;

  const pvRow = await env.DB.prepare(
    `SELECT COUNT(*) AS pv FROM events WHERE site = ? AND type = 'pageview' AND ts >= ?`
  )
    .bind(site, sinceTs)
    .first();

  const uvRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT visitor_id) AS uv FROM events WHERE site = ? AND ts >= ? AND visitor_id IS NOT NULL AND visitor_id != ''`
  )
    .bind(site, sinceTs)
    .first();

  const topPages = await env.DB.prepare(
    `SELECT path, COUNT(*) AS pv
     FROM events
     WHERE site = ? AND type = 'pageview' AND ts >= ?
     GROUP BY path
     ORDER BY pv DESC
     LIMIT 20`
  )
    .bind(site, sinceTs)
    .all();

  const recent = await env.DB.prepare(
    `SELECT ts, type, path, referrer, session_id, visitor_id, data
     FROM events
     WHERE site = ? AND ts >= ?
     ORDER BY ts DESC
     LIMIT 50`
  )
    .bind(site, sinceTs)
    .all();

  return json(
    {
      ok: true,
      site,
      sinceMin,
      pv: pvRow?.pv || 0,
      uv: uvRow?.uv || 0,
      topPages: topPages?.results || [],
      recent: recent?.results || [],
    },
    { headers: cors }
  );
}

function trackerJsTemplate() {
  // 非模块脚本：直接挂到 window 上并自动上报
  return `(() => {
  const currentScript = document.currentScript || (function(){
    const s = document.getElementsByTagName('script');
    return s[s.length-1];
  })();
  const SITE = currentScript?.dataset?.site || location.host;
  const ENDPOINT = currentScript?.dataset?.endpoint || '/collect';

  const LS_VID = '__wt_vid';
  const SS_SID = '__wt_sid';

  function randId(prefix){
    const r = Math.random().toString(16).slice(2);
    return prefix + '-' + Date.now().toString(16) + '-' + r;
  }

  function getVisitorId(){
    try{
      let v = localStorage.getItem(LS_VID);
      if(!v){ v = randId('v'); localStorage.setItem(LS_VID, v); }
      return v;
    }catch(e){
      return randId('v');
    }
  }

  function getSessionId(){
    try{
      let s = sessionStorage.getItem(SS_SID);
      if(!s){ s = randId('s'); sessionStorage.setItem(SS_SID, s); }
      return s;
    }catch(e){
      return randId('s');
    }
  }

  const visitorId = getVisitorId();
  const sessionId = getSessionId();

  function post(type, data){
    const payload = {
      site: SITE,
      type,
      ts: Date.now(),
      session_id: sessionId,
      visitor_id: visitorId,
      url: location.href,
      path: location.pathname + location.search + location.hash,
      referrer: document.referrer || '',
      data: data || {}
    };

    const body = JSON.stringify(payload);
    // 尽量不阻塞：sendBeacon 优先
    if(navigator.sendBeacon){
      const blob = new Blob([body], {type:'application/json'});
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    fetch(ENDPOINT, {method:'POST', headers:{'content-type':'application/json'}, body, keepalive:true}).catch(()=>{});
  }

  // pageview
  post('pageview', {title: document.title});

  // click（记录选择器 + 文本截断）
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('a,button,[role="button"],input,textarea,select,label') : null;
    const target = el || e.target;
    if(!target) return;

    const tag = (target.tagName || '').toLowerCase();
    const id = target.id ? ('#' + target.id) : '';
    const cls = target.className && typeof target.className === 'string'
      ? '.' + target.className.trim().split(/\\s+/).slice(0,3).join('.')
      : '';
    const selector = tag + id + cls;
    const text = (target.innerText || target.value || '').trim().slice(0,120);
    const href = target.getAttribute && target.getAttribute('href') ? target.getAttribute('href') : '';

    post('click', {selector, text, href});
  }, {capture:true, passive:true});

  // scroll depth（节流）
  let maxDepth = 0;
  let lastScrollAt = 0;
  window.addEventListener('scroll', () => {
    const now = Date.now();
    if(now - lastScrollAt < 1000) return;
    lastScrollAt = now;
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const height = Math.max(1, (doc.scrollHeight - window.innerHeight));
    const depth = Math.min(100, Math.round((scrollTop / height) * 100));
    if(depth > maxDepth){
      maxDepth = depth;
      post('scroll', {depth});
    }
  }, {passive:true});

  // duration（页面隐藏/关闭时上报一次）
  const startAt = Date.now();
  let sent = false;
  function sendDuration(reason){
    if(sent) return;
    sent = true;
    post('duration', {ms: Date.now() - startAt, maxScrollDepth: maxDepth, reason: reason || 'unknown'});
  }
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') sendDuration('hidden');
  });
  window.addEventListener('pagehide', () => sendDuration('pagehide'));

  // 暴露一个自定义事件接口（可选）
  window.WebsiteTracker = { track: (type, data) => post(type || 'custom', data || {}) };
})();`;
}

async function handleTrackerJs(req) {
  const headers = new Headers(corsHeaders(req));
  headers.set("content-type", "application/javascript; charset=utf-8");
  // tracker.js 可缓存一段时间
  headers.set("cache-control", "public, max-age=600");
  return new Response(trackerJsTemplate(), { status: 200, headers });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return new Response("", { status: 204, headers: corsHeaders(req) });

    if (path === "/collect") return handleCollect(req, env);
    if (path === "/stats") return handleStats(req, env);
    if (path === "/tracker.js") return handleTrackerJs(req);

    if (path === "/" || path === "/health") return text("ok");
    return json({ error: "not_found" }, { status: 404, headers: corsHeaders(req) });
  },
};


