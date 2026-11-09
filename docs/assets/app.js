/* ═══════════════════════════════════════════════════════════════
   Site-level behavior: nav, tooltips, Circle of Progress.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

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

  /* ---------- highlight the nav link for the current page ---------- */
  function normalizePath(p) {
    p = (p || '/').split('?')[0].split('#')[0];
    p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return p || '/';
  }
  function initCurrentNav() {
    var here = normalizePath(location.pathname);
    var links = document.querySelectorAll('.site-nav a, .mobile-nav a');
    Array.prototype.forEach.call(links, function (a) {
      if (normalizePath(a.getAttribute('href')) === here) a.classList.add('is-current');
    });
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

  function init() { initNav(); initCurrentNav(); initTooltips(); initCircle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
