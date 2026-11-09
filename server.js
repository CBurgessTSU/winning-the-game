/* ═══════════════════════════════════════════════════════════════════════
   Winning The Game — site + AI service (zero dependencies)

   This is the ONLY part of the project that needs a server. It does two jobs:

     1. GET  /api/health  — answers instantly. The web page pings this on load
        (and every few minutes while in use) so the free Render service is awake
        by the time a student clicks "Generate My Improvement Plan."

     2. POST /api/plan    — takes the student's lever data, asks Claude for
        personalized recommendations in Josh's coaching voice, and returns them.
        The Anthropic API key lives here on the server and is NEVER sent to the
        browser — that's the whole reason this service exists.

   It can also serve the static site from ./public if you want to run the whole
   thing from one place for local testing (open http://localhost:3000).

   Built with only Node's built-in modules (http, https, fs, path) — nothing to
   install, nothing to keep updated.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

/* ---------- load .env if present (tiny, no dependency) ----------
   Reads KEY=value lines from a local .env file for convenience. On Render you
   set these in the dashboard instead, so this file won't exist there. */
(function loadDotEnv() {
  try {
    var raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    raw.split('\n').forEach(function (line) {
      var s = line.trim();
      if (!s || s[0] === '#') return;
      var eq = s.indexOf('=');
      if (eq === -1) return;
      var key = s.slice(0, eq).trim();
      var val = s.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = val;
    });
  } catch (e) { /* no .env file — that's fine */ }
})();

/* ---------- settings ---------- */
var PORT = process.env.PORT || 3000;
var PUBLIC_DIR = path.join(__dirname, 'docs');  // the static site (served by GitHub Pages from /docs)
var API_KEY = process.env.ANTHROPIC_API_KEY || '';

/* Which origin may call the AI from a browser. "*" works for a public class
   tool (there are no secrets or logins in the browser). To lock it to just your
   GitHub Pages site, set ALLOWED_ORIGIN, e.g.
     ALLOWED_ORIGIN=https://yourname.github.io  */
var ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

/* The Claude model. This is the one line to change to swap models.
   - claude-sonnet-5-5 (default): current-generation Sonnet. It runs adaptive
     "thinking," which we keep shallow (effort "low", set below) so replies stay
     fast and inexpensive for a class tool called many times.
   - claude-opus-5-5: the most capable tier — higher quality, higher cost.
   - claude-sonnet-4-6: previous generation; no thinking overhead at all.       */
var MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

/* ---------- the coach's voice (Josh Hesse / TSU methodology) ---------- */
var SYSTEM_PROMPT = [
  'You are the Coach from TradeSmart University (TSU), helping a student find',
  'specific, actionable improvements to their trading. You speak with the voice',
  'of Josh Hesse — encouraging, direct, and grounded in process over outcomes.',
  '',
  'TSU methodology to draw from:',
  '- The R System: risk is defined before every trade. R = 1% of account value.',
  '  Loss Returns should equal R — no more.',
  '- Entry discipline: take only A+ setups that meet ALL criteria. If even one',
  '  criterion is unmet, skip the trade. No exceptions.',
  '- The 3-Day Rule: if a trade has not moved in your favor within 3 trading',
  '  days, exit.',
  '- Breakeven stop: once a trade is profitable, move the stop to breakeven.',
  '  Never let a winner close as a loser.',
  '- Win rate target: TSU traders aim for 70%+. Below 70% = reduce position size',
  '  until the edge returns.',
  '- CANI (Constant And Never-ending Improvement): every improvement is',
  '  process-based and measurable — not "make more money" but "follow my entry',
  '  checklist on 100% of trades."',
  '',
  'For each lever the student targets for improvement, give EXACTLY 2',
  'recommendations. Each recommendation must:',
  '  1. Name a concrete behavior or rule, not a vague concept.',
  '  2. Connect to TSU methodology where it fits.',
  '  3. Be achievable starting this week.',
  '',
  'Use the EXACT lever names the student gives you, spelled the same way, so the',
  'recommendations line up with their plan.',
  '',
  'Respond ONLY with valid JSON. No preamble, no markdown fences, no text',
  'outside the JSON. Use this exact shape:',
  '{',
  '  "levers": [',
  '    {',
  '      "lever": "Win-Loss Ratio",',
  '      "currentValue": "65%",',
  '      "targetValue": "70%",',
  '      "recommendations": ["rec one", "rec two"]',
  '    }',
  '  ],',
  '  "closingNote": "One sentence of genuine encouragement specific to this plan."',
  '}'
].join('\n');

/* ---------- turn the student's data into the user message ---------- */
function buildUserPrompt(data) {
  var mode = data.mode === 'r-values' ? 'R-Values' : '% Returns';
  var cur = data.current || {};
  var proj = data.projected || {};
  var levers = Array.isArray(data.levers) ? data.levers : [];

  var targetLines = levers.map(function (l) {
    return '- ' + l.lever + ': from ' + l.currentValue + ' to ' + l.targetValue;
  }).join('\n');

  var projLine = 'Projected profit after improvements: ' + proj.profit;
  if (data.improvementPct !== null && data.improvementPct !== undefined) {
    projLine += ' (a ' + data.improvementPct + '% improvement)';
  } else if (data.improvementDollars) {
    projLine += ' (' + data.improvementDollars + ' more)';
  }

  return [
    'My current trading metrics (' + mode + ' mode):',
    '- Trades per period: ' + cur.trades,
    '- Win rate: ' + cur.winPct + '%',
    '- Average winner: ' + cur.winReturn,
    '- Average loss: ' + cur.lossReturn,
    '- Current profit: ' + cur.profit,
    '',
    'My improvement targets:',
    targetLines,
    '',
    projLine,
    '',
    'For each lever listed under my improvement targets, give me exactly 2',
    'specific, actionable recommendations in the required JSON format. Use the',
    'exact lever names shown above.'
  ].join('\n');
}

/* ---------- pull JSON out of the model's reply (tolerant of stray text) ---------- */
function parsePlanJSON(text) {
  var t = String(text || '').trim();
  // strip ```json ... ``` fences if the model added them
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    // fall back to the first {...} block
    var start = t.indexOf('{');
    var end = t.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw e;
  }
}

/* ---------- call Claude ---------- */
function callAnthropic(studentData) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify({
      model: MODEL,
      max_tokens: 3000,            // generous: on 5-family models thinking tokens
                                   // count toward this, so leave room for the JSON
      output_config: { effort: 'low' },  // keep thinking shallow — fast + cheap
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(studentData) }]
    });

    var req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(payload)
      }
    }, function (res) {
      var body = '';
      res.on('data', function (d) { body += d; });
      res.on('end', function () {
        var data;
        try { data = JSON.parse(body); }
        catch (e) { return reject(new Error('Bad response from Anthropic: ' + body.slice(0, 200))); }

        if (res.statusCode !== 200) {
          var msg = (data && data.error && data.error.message) || ('HTTP ' + res.statusCode);
          return reject(new Error('Anthropic error: ' + msg));
        }
        if (data.stop_reason === 'refusal') {
          return reject(new Error('The model declined this request.'));
        }
        // find the text block (there may be other block types ahead of it)
        var textBlock = (data.content || []).find(function (b) { return b.type === 'text'; });
        if (!textBlock) { return reject(new Error('No text in Anthropic response.')); }

        try { resolve(parsePlanJSON(textBlock.text)); }
        catch (e) { reject(new Error('Could not parse plan JSON: ' + e.message)); }
      });
    });

    req.on('error', reject);
    req.setTimeout(45000, function () { req.destroy(new Error('Anthropic request timed out.')); });
    req.write(payload);
    req.end();
  });
}

/* ---------- small helpers ---------- */
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res, status, obj) {
  var out = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(out) });
  res.end(out);
}

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function serveStatic(req, res) {
  var urlPath = decodeURIComponent((req.url.split('?')[0]) || '/');
  if (urlPath === '/') urlPath = '/index.html';
  // resolve safely inside PUBLIC_DIR (block path traversal)
  var filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (filePath.indexOf(PUBLIC_DIR) !== 0) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  function notFound() {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
  // Send a file with an ETag + revalidate-always caching so browsers can never
  // run a stale asset (the usual cause of "I changed it but the page didn't").
  // `no-cache` means "you may cache, but revalidate every time" — on a match we
  // return a cheap 304 and the browser reuses its copy.
  function deliver(content, ext) {
    var etag = '"' + crypto.createHash('sha1').update(content).digest('hex') + '"';
    var headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'ETag': etag
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(content);
  }
  function send(fp) {
    fs.readFile(fp, function (err, content) {
      if (err) {
        // Pretty URL with no extension (e.g. /levers) → serve /levers.html
        if (!path.extname(fp)) { send2(fp + '.html'); return; }
        notFound();
        return;
      }
      deliver(content, path.extname(fp).toLowerCase());
    });
  }
  function send2(fp) {
    fs.readFile(fp, function (err, content) {
      if (err) { notFound(); return; }
      deliver(content, '.html');
    });
  }
  send(filePath);
}

/* ---------- the server ---------- */
var server = http.createServer(function (req, res) {
  var pathname = (req.url.split('?')[0]) || '/';

  // CORS preflight for the API
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // warm-up ping — must be instant and cheap
  if (pathname === '/api/health') {
    setCors(res);
    sendJson(res, 200, { ok: true, ai: Boolean(API_KEY) });
    return;
  }

  // generate the plan
  if (pathname === '/api/plan' && req.method === 'POST') {
    setCors(res);
    if (!API_KEY) {
      sendJson(res, 503, { error: 'AI is not configured on the server (missing ANTHROPIC_API_KEY).' });
      return;
    }
    var chunks = '';
    var tooBig = false;
    req.on('data', function (d) {
      chunks += d;
      if (chunks.length > 1e6) { tooBig = true; req.destroy(); } // 1MB guard
    });
    req.on('end', function () {
      if (tooBig) { sendJson(res, 413, { error: 'Request too large.' }); return; }
      var studentData;
      try { studentData = JSON.parse(chunks || '{}'); }
      catch (e) { sendJson(res, 400, { error: 'Invalid JSON.' }); return; }

      callAnthropic(studentData).then(function (plan) {
        sendJson(res, 200, plan);
      }).catch(function (err) {
        // The page falls back to "write your own plan" on any non-200,
        // so the exact message here is just for server logs.
        console.error('plan error:', err && err.message);
        sendJson(res, 502, { error: 'Could not generate a plan right now.' });
      });
    });
    return;
  }

  // anything else → static site
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, function () {
  console.log('Winning The Game server listening on http://localhost:' + PORT);
  console.log('  AI feature: ' + (API_KEY ? 'ON (model ' + MODEL + ')' : 'OFF — set ANTHROPIC_API_KEY to enable'));
});
