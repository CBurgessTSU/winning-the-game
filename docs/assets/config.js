/* ───────────────────────────────────────────────────────────────
   TSU Trader Tools — site configuration

   This is the ONLY file you edit to turn the AI feature on.

   aiBaseUrl: the web address of your Render AI service.
     • Leave it as "" (empty) for now. The 4 Levers calculator works
       fully without it — the "Generate my plan" button just shows a
       friendly "write your own plan" message.
     • Once the Render service is deployed, paste its URL here, e.g.
         aiBaseUrl: "https://tsu-tools-ai.onrender.com"
       Save, re-deploy the page, and the AI turns on. No code changes.

   When aiBaseUrl is set, the page will:
     1. ping <aiBaseUrl>/api/health on load to wake the free Render
        service, so it's ready by the time a student clicks the button;
     2. send plan requests to <aiBaseUrl>/api/plan.
   ─────────────────────────────────────────────────────────────── */
window.TSU_CONFIG = {
  aiBaseUrl: ""
};
