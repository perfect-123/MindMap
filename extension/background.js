const SUPABASE_URL = "https://sagbrkjfdqxqndrfekkp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZ2Jya2pmZHF4cW5kcmZla2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTkzNjgsImV4cCI6MjA5MDI5NTM2OH0.R3X09rKRcUES59xnLP_dsQacq6b5gg2QiTIfbTOeTxI";

async function getOrCreateSession() {
  const stored = await chrome.storage.local.get("supabase_session");
  if (stored.supabase_session) return stored.supabase_session;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();
  await chrome.storage.local.set({ supabase_session: data });
  return data;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const session = await getOrCreateSession();
    const token = session.access_token;
    const user_id = session.user?.id;

    let domain = "";
    try {
      domain = new URL(tab.url).hostname;
    } catch (_) {
      return; // skip invalid URLs (e.g. chrome:// pages)
    }

    const event = {
      url: tab.url,
      title: tab.title,
      category: "uncategorized",
      duration: 0,
      domain,
      user_id,
      created_at: new Date().toISOString(),
    };

    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    });

    console.log("Event sent:", event);
  }
});
