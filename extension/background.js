const SUPABASE_URL = "https://sagbrkjfdqxqndrfekkp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZ2Jya2pmZHF4cW5kcmZla2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTkzNjgsImV4cCI6MjA5MDI5NTM2OH0.R3X09rKRcUES59xnLP_dsQacq6b5gg2QiTIfbTOeTxI";

// ─── In-memory state ────────────────────────────────────────────────────────
let activeTabId = null;      // which tab is currently focused
let activeStartTime = null;  // when the user started viewing that tab
const tabEventMap = {};      // tabId → supabase event id

// ─── Auth ────────────────────────────────────────────────────────────────────
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

// ─── Create event in Supabase, returns the new event's id ───────────────────
async function createEvent(tab) {
  const url = tab.url;
  if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) return null;

  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch (_) {
    return null;
  }

  const session = await getOrCreateSession();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      Prefer: "return=representation", // tells Supabase to return the created row
    },
    body: JSON.stringify({
      url,
      title: tab.title,
      category: "uncategorized",
      duration: 0,
      domain,
      user_id: session.user?.id,
      created_at: new Date().toISOString(),
    }),
  });

  const [created] = await res.json();
  console.log("Event created:", created);
  return created?.id ?? null;
}

// ─── Patch duration + ended_at on an existing event ────────────────────────
async function finalizeEvent(tabId) {
  if (!activeStartTime || !tabEventMap[tabId]) return;

  const duration = Math.round((Date.now() - activeStartTime) / 1000); // seconds
  const eventId = tabEventMap[tabId];

  const session = await getOrCreateSession();

  await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      duration,
      ended_at: new Date().toISOString(),
    }),
  });

  console.log(`Finalized tab ${tabId}: ${duration}s`);
}

// ─── Tab finishes loading ────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;

  // If this tab was already being tracked (e.g. user navigated within same tab)
  // finalize the old event first
  if (tabId === activeTabId && tabEventMap[tabId]) {
    await finalizeEvent(tabId);
    activeStartTime = Date.now();
  }

  const eventId = await createEvent(tab);
  if (eventId) {
    tabEventMap[tabId] = eventId;
    // Start timing if this is the currently active tab
    if (tabId === activeTabId) {
      activeStartTime = Date.now();
    }
  }
});

// ─── User switches tabs ───────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  // Finalize the tab we're leaving
  if (activeTabId !== null && activeTabId !== tabId) {
    await finalizeEvent(activeTabId);
  }

  activeTabId = tabId;
  activeStartTime = Date.now();
});

// ─── Chrome window gains/loses focus ────────────────────────────────────────
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // User switched away from Chrome entirely — stop the clock
    if (activeTabId !== null) {
      await finalizeEvent(activeTabId);
      activeStartTime = null;
    }
  } else {
    // User came back to Chrome — restart the clock
    activeStartTime = Date.now();
  }
});
