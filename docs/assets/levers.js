/* ═══════════════════════════════════════════════════════════════
   4 Levers of Profitability — calculator engine + UI
   All math verified against Josh's worksheet examples (see build spec).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.TSU_CONFIG || { aiBaseUrl: '' };
  var TRADING_DAYS = 252;

  // Where the AI service lives. If aiBaseUrl is set, use it (points the page at
  // a service on another host). If it's blank, the service is the same server
  // that delivered this page — the normal setup on Render — so use this origin.
  // Returns '' only when the page was opened from a file (no server, AI off).
  function aiBase() {
    var v = cfg.aiBaseUrl && String(cfg.aiBaseUrl).trim();
    if (v) return v.replace(/\/$/, '');
    if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
    return '';
  }

  /* ---------- state (kept separately per mode) ---------- */
  function blankInputs() { return { trades: '', value: '', wins: '', winReturn: '', lossReturn: '', commissions: '' }; }
  function blankTargets() { return { trades: '', winpct: '', win: '', loss: '' }; }
  var data = {
    percent: { inputs: blankInputs(), targets: blankTargets() },
    r: { inputs: blankInputs(), targets: blankTargets() }
  };
  var mode = 'percent';
  var commitments = {};   // keyed by lever name, so recalcs don't lose typed text
  var lastPlan = null;    // last AI response (or fallback marker)

  var inEls = { trades: 'in-trades', value: 'in-value', wins: 'in-wins', winReturn: 'in-win-return', lossReturn: 'in-loss-return', commissions: 'in-commissions' };
  var tgEls = { trades: 'tg-trades', winpct: 'tg-winpct', win: 'tg-win', loss: 'tg-loss' };

  /* ---------- helpers ---------- */
  function num(v) { if (v === '' || v === null || v === undefined) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }
  function money(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
  }
  function pct(n, dp) { if (n === null || isNaN(n)) return '—'; return (n).toFixed(dp === undefined ? 1 : dp) + '%'; }
  function rMult(n) { if (n === null || isNaN(n)) return '—'; return (Math.round(n * 10) / 10).toFixed(1) + 'R'; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ---------- math ---------- */
  // Returns a computed baseline object, or null if required inputs are missing.
  function computeBaseline(m, i) {
    var trades = num(i.trades), value = num(i.value), wins = num(i.wins),
      wr = num(i.winReturn), lr = num(i.lossReturn), comm = num(i.commissions) || 0;
    if (trades === null || trades <= 0) return null;
    if (value === null || value <= 0) return null;
    if (wins === null || wins < 0 || wins > trades) return null;
    if (wr === null || lr === null) return null;

    var losses = trades - wins;
    var winPct = wins / trades * 100;
    var lossPct = losses / trades * 100;
    var winTotal, lossTotal, profit, roi = null, totalR = null;

    if (m === 'percent') {
      winTotal = wins * (wr / 100 * value);
      lossTotal = losses * (lr / 100 * value);
      profit = winTotal - lossTotal - comm;
      roi = profit / (trades * value) * 100;
    } else {
      winTotal = wins * (wr * value);
      lossTotal = losses * (lr * value);
      profit = winTotal - lossTotal;
      totalR = profit / value;
    }
    return { trades: trades, value: value, wins: wins, losses: losses, winReturn: wr, lossReturn: lr,
      commissions: comm, winPct: winPct, lossPct: lossPct, profit: profit, roi: roi, totalR: totalR };
  }

  // Applies targets (deltas) to a baseline. Returns projected object or null.
  function computeProjected(m, base, t) {
    if (!base) return null;
    var dTrades = num(t.trades) || 0, dWinPct = num(t.winpct) || 0, dWin = num(t.win) || 0, dLoss = num(t.loss) || 0;
    var newTrades = clamp(Math.round(base.trades + dTrades), 1, 100000);
    var newWinPct = clamp(base.winPct + dWinPct, 0, 100);
    var newWins = clamp(Math.round(newWinPct / 100 * newTrades), 0, newTrades);
    var newLosses = newTrades - newWins;
    var newWr = Math.max(0, base.winReturn + dWin);
    var newLr = Math.max(0, base.lossReturn + dLoss);
    var winTotal, lossTotal, profit, roi = null, totalR = null;

    if (m === 'percent') {
      winTotal = newWins * (newWr / 100 * base.value);
      lossTotal = newLosses * (newLr / 100 * base.value);
      profit = winTotal - lossTotal - base.commissions;
      roi = profit / (newTrades * base.value) * 100;
    } else {
      winTotal = newWins * (newWr * base.value);
      lossTotal = newLosses * (newLr * base.value);
      profit = winTotal - lossTotal;
      totalR = profit / base.value;
    }
    return { trades: newTrades, wins: newWins, losses: newLosses, winReturn: newWr, lossReturn: newLr,
      winPct: newWins / newTrades * 100, profit: profit, roi: roi, totalR: totalR };
  }

  function hasAnyTarget(t) {
    return [t.trades, t.winpct, t.win, t.loss].some(function (v) { var n = num(v); return n !== null && n !== 0; });
  }

  /* ---------- read inputs into state ---------- */
  function readFields() {
    var d = data[mode];
    Object.keys(inEls).forEach(function (k) { var el = $(inEls[k]); if (el) d.inputs[k] = el.value; });
    Object.keys(tgEls).forEach(function (k) { var el = $(tgEls[k]); if (el) d.targets[k] = el.value; });
  }
  function writeFields() {
    var d = data[mode];
    Object.keys(inEls).forEach(function (k) { var el = $(inEls[k]); if (el) el.value = d.inputs[k]; });
    Object.keys(tgEls).forEach(function (k) { var el = $(tgEls[k]); if (el) el.value = d.targets[k]; });
  }

  /* ---------- the main recompute + render ---------- */
  function update() {
    readFields();
    var d = data[mode];
    var base = computeBaseline(mode, d.inputs);

    // Loss > 1.2R warning (R mode only)
    var lossWarn = $('loss-warn');
    var lrVal = num(d.inputs.lossReturn);
    lossWarn.hidden = !(mode === 'r' && lrVal !== null && lrVal > 1.2);

    // Derived row
    var derivedRow = $('winloss-derived');
    if (base) {
      derivedRow.hidden = false;
      $('out-losses').textContent = base.losses;
      $('out-winpct').textContent = pct(base.winPct);
      $('out-losspct').textContent = pct(base.lossPct);
    } else {
      derivedRow.hidden = true;
    }

    // Current P&L
    if (base) {
      $('out-current-profit').textContent = money(base.profit);
      if (mode === 'percent') { $('current-secondary-label').textContent = 'ROI'; $('out-current-secondary').textContent = pct(base.roi); }
      else { $('current-secondary-label').textContent = 'Total R'; $('out-current-secondary').textContent = rMult(base.totalR); }
    } else {
      $('out-current-profit').textContent = '—';
      $('out-current-secondary').textContent = '—';
      $('current-secondary-label').textContent = mode === 'percent' ? 'ROI' : 'Total R';
    }

    // Targets column unlock
    var targetsCol = $('targets-col'), targetsBody = $('targets-body');
    if (base) { targetsCol.classList.remove('is-locked'); targetsBody.hidden = false; }
    else { targetsCol.classList.add('is-locked'); targetsBody.hidden = true; }

    // Projected
    var proj = base ? computeProjected(mode, base, d.targets) : null;
    var engaged = base && hasAnyTarget(d.targets) && proj;

    if (proj) {
      $('out-projected-profit').textContent = money(proj.profit);
      if (mode === 'percent') { $('projected-secondary-label').textContent = 'ROI'; $('out-projected-secondary').textContent = pct(proj.roi); }
      else { $('projected-secondary-label').textContent = 'Total R'; $('out-projected-secondary').textContent = rMult(proj.totalR); }
    } else {
      $('out-projected-profit').textContent = '—';
      $('out-projected-secondary').textContent = '—';
    }

    // Target inline results (current → projected)
    renderTargetResult('tg-trades-result', d.targets.trades, base && base.trades, proj && proj.trades);
    renderTargetResult('tg-winpct-result', d.targets.winpct, base && pct(base.winPct, 0), proj && pct(proj.winPct, 0));
    var unit = mode === 'percent' ? '%' : 'R';
    renderTargetResult('tg-win-result', d.targets.win, base && fmtUnit(base.winReturn, unit), proj && fmtUnit(proj.winReturn, unit));
    renderTargetResult('tg-loss-result', d.targets.loss, base && fmtUnit(base.lossReturn, unit), proj && fmtUnit(proj.lossReturn, unit));

    // Reveal wow / time-in-trade / circle / plan
    toggleReveal(engaged, base, proj);

    // Time in Trade (needs projected profit)
    updateTimeInTrade(base, proj, engaged);
  }

  function fmtUnit(v, unit) { if (v === null || v === undefined) return '—'; var n = Math.round(v * 10) / 10; return (unit === 'R') ? n.toFixed(1) + 'R' : n + '%'; }

  function renderTargetResult(id, raw, cur, proj) {
    var el = $(id); if (!el) return;
    var n = num(raw);
    if (n === null || n === 0 || cur === null || cur === false || proj === null || proj === false) { el.innerHTML = ''; return; }
    el.innerHTML = cur + ' <span class="arrow">→</span> <span class="to">' + proj + '</span>';
  }

  /* ---------- reveal / wow ---------- */
  var wowShownValue = null;
  function toggleReveal(engaged, base, proj) {
    var wow = $('wow'), tit = $('time-in-trade'), cop = $('circle-of-progress'), plan = $('plan-section');
    if (engaged) {
      if (wow.hidden) { wow.hidden = false; }
      tit.hidden = false; cop.hidden = false; plan.hidden = false;
      // improvement value
      var curP = base.profit, projP = proj.profit;
      var usePct = curP > 0;
      var val = usePct ? Math.round((projP - curP) / Math.abs(curP) * 100) : (projP - curP);
      if (val !== wowShownValue) { animateWow(val, usePct); wowShownValue = val; }
      document.dispatchEvent(new CustomEvent('tsu:plan-visible'));
    } else {
      wow.hidden = true; tit.hidden = true; cop.hidden = true; plan.hidden = true;
      wowShownValue = null;
    }
  }

  function animateWow(target, usePct) {
    var el = $('wow-number');
    var fmt = function (v) { return usePct ? (Math.round(v) + '%') : ('+' + money(v)); };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = fmt(target); return; }
    var start = performance.now(), dur = 1400, from = 0;
    function step(now) {
      var p = clamp((now - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  /* ---------- Time in Trade ---------- */
  function updateTimeInTrade(base, proj, engaged) {
    var results = $('tit-results');
    if (!engaged) { results.hidden = true; return; }
    var cur = num($('tit-current').value), tgt = num($('tit-target').value);
    if (cur === null || cur <= 0 || tgt === null || tgt <= 0) { results.hidden = true; return; }
    results.hidden = false;
    var curCycles = TRADING_DAYS / cur, projCycles = TRADING_DAYS / tgt;
    var curAnnual = base.profit * curCycles, projAnnual = proj.profit * projCycles;
    var c1 = Math.round(curCycles * 10) / 10, c2 = Math.round(projCycles * 10) / 10;
    $('tit-current-cycles').textContent = c1;
    $('tit-projected-cycles').textContent = c2;
    $('tit-current-annual').textContent = money(curAnnual);
    $('tit-projected-annual').textContent = money(projAnnual);
    var diff = Math.round((projCycles - curCycles) * 10) / 10;
    $('tit-narrative').textContent =
      'At your current pace of ' + cur + ' days per trade, you complete about ' + c1 +
      ' cycles per year. Dropping to ' + tgt + ' days gives you about ' + c2 + ' — roughly ' +
      diff + ' more opportunities to put your edge to work. That turns your projected profit into an annual potential of ' +
      money(projAnnual) + '.';
  }

  /* ---------- which levers were targeted ---------- */
  function targetedLevers() {
    var d = data[mode];
    var base = computeBaseline(mode, d.inputs);
    var proj = computeProjected(mode, base, d.targets);
    if (!base || !proj) return [];
    var unit = mode === 'percent' ? '%' : 'R';
    var out = [];
    function add(cond, name, cur, tgt) { if (cond) out.push({ lever: name, currentValue: cur, targetValue: tgt }); }
    // add() already guards on a non-zero/non-null delta, so out holds only targeted levers
    add(num(d.targets.trades), 'Number of Trades', String(base.trades), String(proj.trades));
    add(num(d.targets.winpct), 'Win-Loss Ratio', pct(base.winPct, 0), pct(proj.winPct, 0));
    add(num(d.targets.win), 'Average Winner', fmtUnit(base.winReturn, unit), fmtUnit(proj.winReturn, unit));
    add(num(d.targets.loss), 'Average Loss', fmtUnit(base.lossReturn, unit), fmtUnit(proj.lossReturn, unit));
    return out;
  }

  /* ---------- build student data for the AI ---------- */
  function buildStudentData() {
    var d = data[mode];
    var base = computeBaseline(mode, d.inputs);
    var proj = computeProjected(mode, base, d.targets);
    var levers = targetedLevers();
    var curP = base.profit, projP = proj.profit;
    var impPct = curP > 0 ? Math.round((projP - curP) / Math.abs(curP) * 100) : null;
    var unit = mode === 'percent' ? '%' : 'R';
    return {
      mode: mode === 'percent' ? 'percent' : 'r-values',
      current: {
        trades: base.trades,
        winPct: Math.round(base.winPct),
        winReturn: fmtUnit(base.winReturn, unit),
        lossReturn: fmtUnit(base.lossReturn, unit),
        profit: money(base.profit)
      },
      projected: { profit: money(proj.profit) },
      improvementPct: impPct,
      improvementDollars: money(projP - curP),
      levers: levers
    };
  }

  /* ---------- AI plan ---------- */
  function generatePlan() {
    var btn = $('generate-plan'), status = $('plan-status');
    var levers = targetedLevers();
    if (!levers.length) {
      status.hidden = false; status.className = 'plan-status'; status.textContent = 'Set at least one improvement target above to build a plan.';
      return;
    }
    var base = aiBase();
    if (!base) { renderPlan(null, levers, 'off'); return; }

    btn.disabled = true;
    status.hidden = false; status.className = 'plan-status';
    status.innerHTML = '<span class="spinner"></span>Writing your plan…';

    fetch(base + '/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildStudentData())
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (plan) {
      status.hidden = true;
      renderPlan(plan, levers, 'ok');
    }).catch(function () {
      status.hidden = true;
      renderPlan(null, levers, 'error');
    }).then(function () { btn.disabled = false; });
  }

  function renderPlan(plan, levers, state) {
    lastPlan = plan;
    var wrap = $('lever-cards');
    wrap.innerHTML = '';

    // map AI recs by lever name
    var recMap = {};
    if (plan && plan.levers) plan.levers.forEach(function (l) { recMap[l.lever] = l; });

    if (state === 'error' || state === 'off') {
      var note = document.createElement('div');
      note.className = 'plan-status is-error';
      note.textContent = state === 'off'
        ? 'The AI coach isn\'t connected yet — write your own plan in the boxes below, one per lever.'
        : 'Couldn\'t reach the AI coach right now. Write your own plan in the boxes below, one per lever.';
      wrap.appendChild(note);
    }

    levers.forEach(function (lv) {
      var ai = recMap[lv.lever];
      var card = document.createElement('div');
      card.className = 'lever-card';
      var recsHtml = '';
      if (ai && ai.recommendations && ai.recommendations.length) {
        recsHtml = '<ul class="lever-recs">' + ai.recommendations.map(function (r) {
          return '<li>' + escapeHtml(r) + '</li>';
        }).join('') + '</ul>';
      }
      var key = lv.lever;
      var saved = commitments[key] ? escapeHtml(commitments[key]) : '';
      card.innerHTML =
        '<div class="lever-card-head"><h4>' + escapeHtml(lv.lever) + '</h4>' +
        '<span class="lever-change">' + escapeHtml(lv.currentValue) + ' <span class="to">→ ' + escapeHtml(lv.targetValue) + '</span></span></div>' +
        recsHtml +
        '<label class="commit-label" for="commit-' + slug(key) + '">What I will specifically do:</label>' +
        '<textarea class="commit-area" id="commit-' + slug(key) + '" data-lever="' + escapeHtml(key) + '" placeholder="e.g. Run my pre-trade checklist on every entry; if one criterion is unmet, I skip the trade.">' + saved + '</textarea>';
      wrap.appendChild(card);
    });

    // Time in Trade commitment (if engaged)
    var titCur = num($('tit-current').value), titTgt = num($('tit-target').value);
    if (titCur && titTgt && titCur > 0 && titTgt > 0) {
      var tcard = document.createElement('div');
      tcard.className = 'lever-card';
      var tkey = 'Time in Trade';
      var tsaved = commitments[tkey] ? escapeHtml(commitments[tkey]) : '';
      tcard.innerHTML =
        '<div class="lever-card-head"><h4>Time in Trade</h4>' +
        '<span class="lever-change">' + titCur + ' days <span class="to">→ ' + titTgt + ' days</span></span></div>' +
        '<ul class="lever-recs"><li>Review any stalled trade against the 3-Day Rule — if it hasn\'t moved in your favor in 3 days, exit.</li>' +
        '<li>Move your stop to breakeven sooner, and set a reminder to review any position that hasn\'t moved in 2 days.</li></ul>' +
        '<label class="commit-label" for="commit-tit">My specific plan to reduce my average hold time:</label>' +
        '<textarea class="commit-area" id="commit-tit" data-lever="' + tkey + '" placeholder="e.g. Every morning I check open trades against the 3-Day Rule and close anything stalled.">' + tsaved + '</textarea>';
      wrap.appendChild(tcard);
    }

    // closing note
    if (plan && plan.closingNote) {
      var cn = document.createElement('div');
      cn.className = 'closing-note';
      cn.textContent = plan.closingNote;
      wrap.appendChild(cn);
    }

    // wire commitment textareas
    Array.prototype.forEach.call(wrap.querySelectorAll('.commit-area'), function (ta) {
      ta.addEventListener('input', function () { commitments[ta.getAttribute('data-lever')] = ta.value; });
    });

    $('plan-footer').hidden = false;
  }

  /* ---------- copy commitment card ---------- */
  function copyPlan() {
    var d = data[mode];
    var base = computeBaseline(mode, d.inputs);
    var proj = computeProjected(mode, base, d.targets);
    if (!base || !proj) return;
    var curP = base.profit, projP = proj.profit;
    var imp = curP > 0 ? (Math.round((projP - curP) / Math.abs(curP) * 100) + '%') : ('+' + money(projP - curP));
    var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var lines = [];
    lines.push('My 4 Levers Commitment — ' + date);
    lines.push('');
    lines.push('Current Profit: ' + money(curP) + '  |  Projected Profit: ' + money(projP) + '  |  Improvement: ' + imp);
    lines.push('');
    targetedLevers().forEach(function (lv) {
      lines.push(lv.lever + ': ' + lv.currentValue + ' → ' + lv.targetValue);
      var c = commitments[lv.lever];
      lines.push('My plan: ' + (c && c.trim() ? c.trim() : '(write your plan)'));
      lines.push('');
    });
    var titCur = num($('tit-current').value), titTgt = num($('tit-target').value);
    if (titCur && titTgt) {
      lines.push('Time in Trade: ' + titCur + ' days → ' + titTgt + ' days');
      var tc = commitments['Time in Trade'];
      lines.push('My plan: ' + (tc && tc.trim() ? tc.trim() : '(write your plan)'));
      lines.push('');
    }
    lines.push('I will return after my next 10–20 trades to measure my results and start the next cycle.');
    var text = lines.join('\n');

    var done = function () {
      var fb = $('copy-feedback'); fb.hidden = false; setTimeout(function () { fb.hidden = true; }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- small utils ---------- */
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  /* ---------- mode switch ---------- */
  function setMode(next) {
    if (next === mode) return;
    readFields();              // save current mode's values
    mode = next;
    document.body.setAttribute('data-mode', mode);
    Array.prototype.forEach.call(document.querySelectorAll('.mode-btn'), function (b) {
      var active = b.getAttribute('data-mode') === (mode === 'r' ? 'r' : 'percent');
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    writeFields();             // load next mode's values
    update();
  }

  /* ---------- wiring ---------- */
  function init() {
    document.body.setAttribute('data-mode', 'percent');

    Object.keys(inEls).forEach(function (k) { var el = $(inEls[k]); if (el) el.addEventListener('input', update); });
    Object.keys(tgEls).forEach(function (k) { var el = $(tgEls[k]); if (el) el.addEventListener('input', update); });
    $('tit-current').addEventListener('input', update);
    $('tit-target').addEventListener('input', update);

    Array.prototype.forEach.call(document.querySelectorAll('.mode-btn'), function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode') === 'r' ? 'r' : 'percent'); });
    });

    $('generate-plan').addEventListener('click', generatePlan);
    $('copy-plan').addEventListener('click', copyPlan);

    update();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
