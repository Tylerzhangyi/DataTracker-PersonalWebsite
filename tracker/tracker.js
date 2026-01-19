/* 可选：如果你不想用 Worker 的 /tracker.js 动态下发，也可以把本文件自己托管并注入到站点 */
(() => {
  const currentScript =
    document.currentScript ||
    (function () {
      const s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  const SITE = currentScript?.dataset?.site || location.host;
  // 优先使用 data-endpoint 属性，如果没有则使用默认值
  const ENDPOINT = currentScript?.dataset?.endpoint || "http://110.40.153.38:5555/collect";
  
  // 调试日志（开发时可用）
  if (typeof console !== 'undefined' && console.log) {
    console.log('[WebsiteTracker] 初始化:', { SITE, ENDPOINT });
  }

  const LS_VID = "__wt_vid";
  const SS_SID = "__wt_sid";

  function randId(prefix) {
    const r = Math.random().toString(16).slice(2);
    return prefix + "-" + Date.now().toString(16) + "-" + r;
  }

  function getVisitorId() {
    try {
      let v = localStorage.getItem(LS_VID);
      if (!v) {
        v = randId("v");
        localStorage.setItem(LS_VID, v);
      }
      return v;
    } catch (e) {
      return randId("v");
    }
  }

  function getSessionId() {
    try {
      let s = sessionStorage.getItem(SS_SID);
      if (!s) {
        s = randId("s");
        sessionStorage.setItem(SS_SID, s);
      }
      return s;
    } catch (e) {
      return randId("s");
    }
  }

  const visitorId = getVisitorId();
  const sessionId = getSessionId();

  function post(type, data) {
    const payload = {
      site: SITE,
      type,
      ts: Date.now(),
      session_id: sessionId,
      visitor_id: visitorId,
      url: location.href,
      path: location.pathname + location.search + location.hash,
      referrer: document.referrer || "",
      data: data || {},
    };

    const body = JSON.stringify(payload);
    
    // 添加错误处理和日志
    const handleError = (err) => {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[WebsiteTracker] 发送失败:', err);
      }
    };
    
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        const sent = navigator.sendBeacon(ENDPOINT, blob);
        if (!sent) {
          handleError(new Error('sendBeacon 返回 false'));
        }
      } catch (err) {
        handleError(err);
      }
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(handleError);
  }

  post("pageview", { title: document.title });

  document.addEventListener(
    "click",
    (e) => {
      const el =
        e.target && e.target.closest
          ? e.target.closest("a,button,[role='button'],input,textarea,select,label")
          : null;
      const target = el || e.target;
      if (!target) return;

      const tag = (target.tagName || "").toLowerCase();
      const id = target.id ? "#" + target.id : "";
      const cls =
        target.className && typeof target.className === "string"
          ? "." + target.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
      const selector = tag + id + cls;
      const text = (target.innerText || target.value || "").trim().slice(0, 120);
      const href = target.getAttribute && target.getAttribute("href") ? target.getAttribute("href") : "";

      post("click", { selector, text, href });
    },
    { capture: true, passive: true }
  );

  let maxDepth = 0;
  let lastScrollAt = 0;
  window.addEventListener(
    "scroll",
    () => {
      const now = Date.now();
      if (now - lastScrollAt < 1000) return;
      lastScrollAt = now;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const height = Math.max(1, doc.scrollHeight - window.innerHeight);
      const depth = Math.min(100, Math.round((scrollTop / height) * 100));
      if (depth > maxDepth) {
        maxDepth = depth;
        post("scroll", { depth });
      }
    },
    { passive: true }
  );

  const startAt = Date.now();
  let sent = false;
  function sendDuration(reason) {
    if (sent) return;
    sent = true;
    post("duration", { ms: Date.now() - startAt, maxScrollDepth: maxDepth, reason: reason || "unknown" });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sendDuration("hidden");
  });
  window.addEventListener("pagehide", () => sendDuration("pagehide"));

  window.WebsiteTracker = { track: (type, data) => post(type || "custom", data || {}) };
})();


