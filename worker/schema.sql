-- 事件原始表：尽量“可追溯”，仪表盘再做聚合
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  ts INTEGER NOT NULL,              -- epoch ms
  type TEXT NOT NULL,               -- pageview/click/scroll/visibility/duration/custom

  session_id TEXT,                  -- 同一访客一次会话
  visitor_id TEXT,                  -- 匿名访客 id（本地存储生成）

  url TEXT,
  path TEXT,
  referrer TEXT,

  ua TEXT,
  ip_hash TEXT,                     -- 服务器侧对 IP 做 hash/截断后存（避免明文 IP）

  -- 事件载荷（小体量 JSON）
  data TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events(site, ts);
CREATE INDEX IF NOT EXISTS idx_events_site_type_ts ON events(site, type, ts);
CREATE INDEX IF NOT EXISTS idx_events_site_session_ts ON events(site, session_id, ts);


