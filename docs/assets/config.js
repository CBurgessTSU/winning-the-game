/* ───────────────────────────────────────────────────────────────
   TSU Trader Tools — site configuration

   aiBaseUrl: where the AI service lives.

     • Leave it as "" (empty) for the normal setup. The site and the AI
       service run together on one Render service, so the page finds the
       AI automatically on whatever address serves it — your Render URL
       or your custom domain. No edit needed when the domain changes.

     • Only set this if you ever host the AI service on a DIFFERENT
       address than the website, e.g.
         aiBaseUrl: "https://tsu-tools-ai.onrender.com"

   The 4 Levers calculator always works, with or without the AI. If the
   AI service can't be reached, the "Generate my plan" button simply
   shows "write your own plan" boxes instead.
   ─────────────────────────────────────────────────────────────── */
window.TSU_CONFIG = {
  aiBaseUrl: ""
};
