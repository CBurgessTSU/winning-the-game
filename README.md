# TSU Trader Tools

A single-page microsite hosting custom tools for a TradeSmart University class:

1. **4 Levers of Profitability Calculator** — built and working.
2. **Mindset Assessment Worksheet** — placeholder (waiting on spec).
3. **10 Conversations To Change Your Trading** — placeholder (waiting on spec).

The site is plain HTML/CSS/JavaScript — no build step, no frameworks, nothing to
install to view it. The only moving part is a tiny AI service (`server.js`) that
powers the "Generate My Improvement Plan" button on the calculator.

```
docs/              ← the website (GitHub Pages publishes this folder)
  index.html
  assets/
    config.js      ← the ONE file you edit to turn the AI on
    styles.css
    levers.js
    app.js
server.js          ← the tiny AI service (host this on Render)
render.yaml        ← Render blueprint (pre-fills the service settings)
package.json
.env.example
```

---

## How the hosting works (and why it's split in two)

The calculator runs entirely in the browser, so it should load instantly and
never go down. The AI feature needs a server to hold the secret Anthropic API
key (a key can't be safely placed in a public web page).

So the two halves live in two places:

- **The website** → **GitHub Pages** (free, always instant to load).
- **The AI service** → **Render** (free tier) — it does nothing but answer the
  AI button and a wake-up ping.

Render's free tier goes to sleep after about 15 minutes of no traffic and takes
~30–60 seconds to wake up. To hide that from students, the page quietly pings
the service when it loads — and again every few minutes while the page is being
used — so it's already awake by the time anyone clicks the AI button. If the
page sits unused, the pings stop and the service is allowed to sleep.

**The calculator works with or without the AI service.** If the service is off
or asleep, the "Generate My Plan" button simply shows "write your own plan"
boxes instead of AI recommendations — nothing breaks.

---

## Run it locally

You need Node.js 18 or newer. No `npm install` is required — the server uses
only Node's built-in modules.

```bash
# 1. add your API key
cp .env.example .env
#    then edit .env and paste your key after ANTHROPIC_API_KEY=

# 2. start the server (it also serves the website for local testing)
npm start
```

Open <http://localhost:3000>. The calculator works immediately; the AI button
works once your key is in `.env`.

To test the calculator by itself without the server, just open
`docs/index.html` in a browser.

---

## Deploy

### 1. The website → GitHub Pages

GitHub Pages publishes the `docs/` folder on the `main` branch (set during
setup). Every push to `main` rebuilds the site. GitHub gives you a URL like
`https://yourname.github.io/your-repo/`.

At this point the site is live and the calculator works. The AI button will say
"not connected yet" until you do step 3 below.

### 2. The AI service → Render

This repo includes a `render.yaml` blueprint, so Render pre-fills the settings.

1. Create a free account at <https://render.com>.
2. **New → Blueprint** (or **New → Web Service**), and connect this GitHub repo.
   Render reads `render.yaml` and fills in the build/start commands for you.
3. Settings (already set by the blueprint — just confirm):
   - **Build Command:** `echo "no build needed"` (there's nothing to build)
   - **Start Command:** `node server.js`
   - **Instance type:** Free
4. Under **Environment**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - *(optional)* `ALLOWED_ORIGIN` = your GitHub Pages URL (e.g.
     `https://yourname.github.io`) to lock the AI to just your site
   - *(optional)* `CLAUDE_MODEL` = a different model (see below)
5. Deploy. Render gives you a URL like
   `https://tsu-trader-tools.onrender.com`.

### 3. Connect them

Open `docs/assets/config.js` and paste the Render URL:

```js
window.TSU_CONFIG = {
  aiBaseUrl: "https://tsu-trader-tools.onrender.com"
};
```

Commit and push. GitHub Pages redeploys, and the AI button is now live. That's
the only code change needed to turn the AI on.

---

## Changing the AI model

The model is one line in `server.js` (or the `CLAUDE_MODEL` env var on Render):

- **`claude-sonnet-5-5`** (default) — current-generation Sonnet. It uses adaptive
  "thinking," which the server keeps shallow (effort `low`) so replies stay fast
  and inexpensive for a class tool called many times.
- **`claude-opus-5-5`** — the most capable tier: higher quality, higher cost.
- **`claude-sonnet-4-6`** — previous generation; no thinking overhead at all.

---

## Adding the other two tools later

When Josh's specs arrive, the placeholder sections in `docs/index.html`
(`#mindset` and `#conversations`) are where the next two tools go. They can be
built the same way — all client-side, with the AI service reused if any of them
needs Claude.
