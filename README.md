# Winning The Game

A single-page microsite hosting custom tools for a TradeSmart University class:

1. **4 Levers of Profitability Calculator** — built and working.
2. **10 Conversations To Change Your Trading** — built. A prompt library for
   Josh-Bot (https://joshbot.tradesmartu.com): the Mindset Assessment is the
   "Start here" card, followed by ten more prompts. Students copy a prompt and
   paste it into Josh-Bot. The prompts live in `docs/assets/conversations-data.js`
   (copied from `sources/Prompt_Guide_WinningTheGame_Nov_12_2.txt`).
   `/mindset` redirects to `/conversations`.

The site is plain HTML/CSS/JavaScript — no build step, no frameworks, nothing to
install. A tiny Node service (`server.js`) serves the pages and powers the
"Generate My Improvement Plan" button on the calculator.

```
docs/              ← the website (served by the Node service)
  index.html
  assets/
    config.js      ← site configuration (leave aiBaseUrl blank for the normal setup)
    styles.css
    levers.js
    app.js
server.js          ← the Node service: serves the site AND the AI endpoints
render.yaml        ← Render blueprint (pre-fills the service settings)
package.json
.env.example
```

---

## How the hosting works

Everything runs as **one service on Render** — the website and the AI feature
together. The service:

- serves the static site from `docs/`, and
- answers the AI request at `/api/plan`, holding the secret Anthropic API key
  server-side (a key can't be safely placed in a public web page).

Because the page and the AI live on the same address, the AI turns on
automatically — there's nothing to wire up and nothing to change when you put a
custom domain on it.

The service runs on Render's **Starter** plan ($7/month), which is always on —
no sleeping, no cold-start delay before the AI button responds.

**The calculator works with or without the AI.** If the AI can't be reached, the
"Generate My Plan" button simply shows "write your own plan" boxes instead of AI
recommendations — nothing breaks.

---

## Run it locally

You need Node.js 18 or newer. No `npm install` is required — the server uses
only Node's built-in modules.

```bash
# 1. add your API key
cp .env.example .env
#    then edit .env and paste your key after ANTHROPIC_API_KEY=

# 2. start the server (serves the site and the AI endpoints)
npm start
```

Open <http://localhost:3000>. The calculator works immediately; the AI button
works once your key is in `.env`.

To test the calculator by itself without the server, just open
`docs/index.html` in a browser (the AI button shows the "write your own plan"
fallback, since there's no service to call).

---

## Deploy to Render

This repo includes a `render.yaml` blueprint, so Render pre-fills the settings.

1. Create an account at <https://render.com>.
2. **New → Blueprint**, and connect this GitHub repo. Render reads `render.yaml`
   and fills in the plan, build command, and start command for you.
3. Settings (already set by the blueprint — just confirm):
   - **Plan:** Starter ($7/mo, always on)
   - **Build Command:** `echo "no build needed"` (there's nothing to build)
   - **Start Command:** `node server.js`
   - **Health Check Path:** `/api/health`
4. Under **Environment**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - *(optional)* `CLAUDE_MODEL` = a different model (see below)
5. Deploy. Render gives you a URL like `https://winning-the-game.onrender.com`.
   The full site and the AI button are live at that URL immediately.

Every push to the `main` branch redeploys the service automatically.

### Custom domain

In the Render service, open **Settings → Custom Domains**, add your domain
(e.g. `tools.yoursite.com`), and Render shows the DNS record to add at your
domain registrar. Once DNS propagates, Render issues an HTTPS certificate
automatically. No code change is needed — the AI keeps working on the new
domain because it lives on the same service.

---

## Changing the AI model

The model is one line in `server.js` (or the `CLAUDE_MODEL` env var on Render,
which changes it with no code edit):

- **`claude-sonnet-5-5`** (default) — current-generation Sonnet. It uses adaptive
  "thinking," which the server keeps shallow (effort `low`) so replies stay fast
  and inexpensive for a class tool called many times.
- **`claude-opus-5-5`** — the most capable tier: higher quality, higher cost.
- **`claude-sonnet-4-6`** — previous generation; no thinking overhead at all.
