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

  function init() { initNav(); initScrollSpy(); initTooltips(); initCircle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
