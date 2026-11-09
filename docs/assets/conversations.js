/* ═══════════════════════════════════════════════════════════════
   10 Conversations — builds the prompt cards from TSU_PROMPTS
   (conversations-data.js) and handles Copy / Open Josh-Bot.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var JOSHBOT_URL = 'https://joshbot.tradesmartu.com';
  var prompts = window.TSU_PROMPTS || [];

  /* Friendly display titles (the copied prompt text is never changed). */
  var TITLE_OVERRIDE = {
    1: 'Mindset Assessment',
    7: 'Model of the World Trading Impact Analysis',
    10: 'Model of the World Check-In'
  };
  var SMALL = { 'my': 1, 'of': 1, 'the': 1, 'a': 1 };
  function titleCase(s) {
    return s.toLowerCase().split(' ').map(function (w, i) {
      if (w === 'mow') return 'MOW';
      return (i > 0 && SMALL[w]) ? w : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }
  /* Glue the last two words together so a lone word never hangs on its own line. */
  function tidy(t) { return t.replace(/ (\S+)$/, '\u00A0$1'); }
  function displayTitle(p) { return TITLE_OVERRIDE[p.n] || titleCase(p.title); }

  /* Groups for prompts 2–11 (prompt 1 is the "Start here" card). */
  var GROUPS = [
    { launch: true, title: 'Go deeper, one filter at a time', note: 'Each one looks at a single lens you see the market through. Use them on their own, or after the Mindset Assessment.', ns: [2, 3, 4, 5, 6] },
    { title: 'Turn what you learned into a plan', note: 'Use these once you have completed your filters.', ns: [7, 8] },
    { title: 'Keep it going as you trade', note: 'Use these after a trade that went off-plan, on a regular schedule, and to record the results.', ns: [9, 10, 11] }
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function buildActions(p, det) {
    var actions = el('div', 'cv-actions');
    var btn = el('button', 'cv-copy', 'Copy prompt');
    btn.type = 'button';
    var fb = el('span', 'copy-feedback');
    fb.setAttribute('role', 'status');
    actions.appendChild(btn); actions.appendChild(fb);
    var timer;
    btn.addEventListener('click', function () {
      copyText(p.prompt).then(function () {
        btn.textContent = 'Copied';
        btn.classList.add('is-done');
        fb.textContent = ''; fb.classList.remove('is-error');
      }, function () {
        fb.textContent = 'Couldn’t copy automatically. Open “Read the prompt” and select the text.';
        fb.classList.add('is-error');
        det.open = true;
      });
      clearTimeout(timer);
      timer = setTimeout(function () {
        btn.textContent = 'Copy prompt';
        btn.classList.remove('is-done');
        if (!fb.classList.contains('is-error')) fb.textContent = '';
      }, 3000);
    });
    return actions;
  }

  function buildPreview(p) {
    var det = el('details', 'cv-preview');
    det.appendChild(el('summary', null, 'Read the prompt'));
    det.appendChild(el('pre', null, p.prompt));
    return det;
  }

  /* The one feature card: Prompt 1, the Mindset Assessment. */
  function buildStart(p) {
    var card = el('article', 'cv-start');
    card.id = 'prompt-' + p.n;
    card.appendChild(el('span', 'cv-pill', 'Start here'));
    card.appendChild(el('h2', 'cv-start-title', displayTitle(p)));
    var dl = el('dl', 'cv-facts');
    dl.appendChild(el('dt', null, 'Use it when'));
    dl.appendChild(el('dd', null, tidy(p.when)));
    dl.appendChild(el('dt', null, 'Have ready'));
    dl.appendChild(el('dd', null, tidy(p.ready)));
    card.appendChild(dl);
    var det = buildPreview(p);
    var actions = buildActions(p, det);
    actions.classList.add('cv-actions-start');
    card.appendChild(actions);
    card.appendChild(det);
    return card;
  }

  /* Prompts 2–11: one ruled row each. */
  function buildRow(p) {
    var row = el('li', 'cv-row');
    row.id = 'prompt-' + p.n;

    var num = el('div', 'cv-rownum');
    num.setAttribute('aria-label', 'Prompt ' + p.n);
    num.appendChild(el('span', 'cv-rownum-word', 'Prompt'));
    num.appendChild(el('span', 'cv-rownum-n', String(p.n)));
    row.appendChild(num);

    var main = el('div', 'cv-main');
    main.appendChild(el('h3', 'cv-title', displayTitle(p)));
    main.appendChild(el('p', 'cv-when', tidy(p.when)));
    row.appendChild(main);

    var ready = el('div', 'cv-ready');
    ready.appendChild(el('span', 'cv-lbl', 'Have ready'));
    ready.appendChild(el('p', null, tidy(p.ready)));
    row.appendChild(ready);

    var det = buildPreview(p);
    row.appendChild(buildActions(p, det));
    row.appendChild(det);
    return row;
  }

  function init() {
    var host = document.getElementById('cv-list');
    if (!host || !prompts.length) return;
    var byN = {};
    prompts.forEach(function (p) { byN[p.n] = p; });

    if (byN[1]) {
      var startWrap = el('section', 'cv-group');
      startWrap.appendChild(buildStart(byN[1]));
      host.appendChild(startWrap);
    }
    GROUPS.forEach(function (g) {
      var sec = el('section', 'cv-group');
      var gh = el('div', 'cv-group-head');
      var txt = el('div', 'cv-group-text');
      txt.appendChild(el('h2', 'cv-group-title', g.title));
      txt.appendChild(el('p', 'cv-group-note', tidy(g.note)));
      gh.appendChild(txt);
      if (g.launch) {
        var go = el('a', 'cv-launch');
        go.href = JOSHBOT_URL; go.target = '_blank'; go.rel = 'noopener';
        go.appendChild(el('span', 'cv-launch-main', 'Open Josh-Bot ↗'));
        gh.appendChild(go);
      }
      sec.appendChild(gh);
      var grid = el('ol', 'cv-list');
      g.ns.forEach(function (n) { if (byN[n]) grid.appendChild(buildRow(byN[n])); });
      sec.appendChild(grid);
      host.appendChild(sec);
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-joshbot-link]'), function (a) {
      a.href = JOSHBOT_URL;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
