/* ═══════════════════════════════════════════════════════════════
   Site-level behavior: nav, tooltips, Circle of Progress,
   and the Render warm-up heartbeat.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.TSU_CONFIG || { aiBaseUrl: '' };

  /* ---------- mobile nav ---------- */
  function initNav() {
    var toggle = document.querySelector('.nav-toggle');
    var panel = $('mobile-nav');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function () {
      var open = panel.hasAttribute('hidden');
      if (open) { panel.removeAttribute('hidden'); } else { panel.setAttribute('hidden', ''); }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    Array.prototype.forEach.call(panel.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { panel.setAttribute('hidden', ''); toggle.setAttribute('aria-expanded', 'false'); });
    });
  }

  /* ---------- active nav link on scroll ---------- */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.site-nav a'));
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
    if (!('IntersectionObserver' in window) || !sections.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.toggle('is-current', l.getAttribute('href') === '#' + e.target.id); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { obs.observe(s); });
  }

  /* ---------- tooltips (.info buttons) ---------- */
  function initTooltips() {
    var bubble = $('tip-bubble');
    if (!bubble) return;
    function show(trigger) {
      var tip = trigger.getAttribute('data-tip');
      if (!tip) return;
      bubble.textContent = tip;
      bubble.hidden = false;
      var r = trigger.getBoundingClientRect();
      var top = r.bottom + window.scrollY + 8;
      var left = r.left + window.scrollX;
      // keep within viewport
      var maxLeft = window.scrollX + document.documentElement.clientWidth - bubble.offsetWidth - 12;
      bubble.style.top = top + 'px';
      bubble.style.left = Math.min(left, maxLeft) + 'px';
    }
    function hide() { bubble.hidden = true; }
    Array.prototype.forEach.call(document.querySelectorAll('.info'), function (t) {
      t.addEventListener('mouseenter', function () { show(t); });
      t.addEventListener('mouseleave', hide);
      t.addEventListener('focus', function () { show(t); });
      t.addEventListener('blur', hide);
      t.addEventListener('click', function (e) { e.preventDefault(); bubble.hidden ? show(t) : hide(); });
    });
  }

  /* ---------- Circle of Progress ---------- */
  function initCircle() {
    var box = $('cop-graphic');
    if (!box) return;
    // dashed ring through the node centers
    var ring = document.createElement('div');
    ring.style.cssText = 'position:absolute;left:14%;top:14%;width:72%;height:72%;border-radius:50%;border:1.5px dashed rgba(0,0,0,0.14);';
    box.appendChild(ring);

    var nodes = [
      { label: 'Goal', cls: 'is-done' },
      { label: 'Plan', cls: 'is-active' },
      { label: 'Execute', cls: '' },
      { label: 'Measure', cls: 'is-done' },
      { label: 'Correct', cls: '' }
    ];
    nodes.forEach(function (n, i) {
      var a = (-90 + i * 72) * Math.PI / 180;
      var x = 50 + 36 * Math.cos(a);
      var y = 50 + 36 * Math.sin(a);
      var el = document.createElement('div');
      el.className = 'cop-node ' + n.cls;
      el.style.left = x + '%';
      el.style.top = y + '%';
      el.innerHTML = '<span>' + n.label + '</span>';
      box.appendChild(el);
    });
  }

  /* ---------- Render warm-up heartbeat ---------- */
  function initWarmup() {
    var base = cfg.aiBaseUrl && String(cfg.aiBaseUrl).trim();
    if (!base) return;                       // AI not configured yet — nothing to warm
    var url = base.replace(/\/$/, '') + '/api/health';
    var INTERVAL = 10 * 60 * 1000;           // ping every 10 min
    var ACTIVE_WINDOW = 14 * 60 * 1000;      // only if interacted within last 14 min
    var EVENT_THROTTLE = 3 * 60 * 1000;      // plan-visible re-ping no more than every 3 min
    var lastActivity = Date.now();
    var lastEventPing = 0;

    function ping() {
      try { fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store', keepalive: true }).catch(function () {}); }
      catch (e) { /* ignore — warm-up is best-effort */ }
    }

    ['pointerdown', 'keydown', 'input', 'scroll', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
    });

    ping();  // initial wake on load

    setInterval(function () {
      if (document.visibilityState === 'hidden') return;          // tab not in view → let it sleep
      if (Date.now() - lastActivity < ACTIVE_WINDOW) ping();      // only while actively used
    }, INTERVAL);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { lastActivity = Date.now(); ping(); }
    });

    // extra insurance: when the plan section first reveals, make sure it's warm
    document.addEventListener('tsu:plan-visible', function () {
      var now = Date.now();
      if (now - lastEventPing > EVENT_THROTTLE) { lastEventPing = now; ping(); }
    });
  }

  function init() { initNav(); initScrollSpy(); initTooltips(); initCircle(); initWarmup(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
