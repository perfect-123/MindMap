importScripts("config.js"); // loads GEMINI_API_KEY from gitignored config.js

const SUPABASE_URL = "https://sagbrkjfdqxqndrfekkp.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZ2Jya2pmZHF4cW5kcmZla2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTkzNjgsImV4cCI6MjA5MDI5NTM2OH0.R3X09rKRcUES59xnLP_dsQacq6b5gg2QiTIfbTOeTxI";

const VALID_CATEGORIES = [
  "learning",
  "entertainment",
  "social media",
  "productivity",
  "news",
  "other",
];

// ─── In-memory state ────────────────────────────────────────────────────────
let activeTabId = null;
let activeStartTime = null;
const tabEventMap = {}; // tabId → supabase event id

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

// ─── Gemini categorization ───────────────────────────────────────────────────
async function classifyWithGemini(url, title) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Classify this website into exactly one category.
URL: ${url}
Title: ${title}

Categories: learning, entertainment, social media, productivity, news, other

Rules:
- "learning" = tutorials, courses, documentation, educational videos, Wikipedia
- "entertainment" = YouTube (non-educational), Netflix, gaming, memes
- "social media" = Twitter/X, Instagram, Reddit, Facebook, TikTok, LinkedIn
- "productivity" = email, coding, Google Docs, project management tools
- "news" = news articles, journalism, blogs about current events
- "other" = anything that doesn't fit above

Reply with only the category word, nothing else.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 50,
          },
        }),
      },
    );

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
      ?.trim()
      .toLowerCase() ?? "";
    const match = VALID_CATEGORIES.find((c) => raw.includes(c));
    return match ?? "other";
  } catch (err) {
    console.warn("Gemini classification failed:", err);
    return "other";
  }
}

// ─── Create event in Supabase, returns the new event's id ───────────────────
async function createEvent(tab) {
  const url = tab.url;
  if (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://")
  )
    return null;

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
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      url,
      title: tab.title,
      category: "uncategorized", // placeholder — Gemini will update this shortly
      duration: 0,
      domain,
      user_id: session.user?.id,
      created_at: new Date().toISOString(),
    }),
  });

  const [created] = await res.json();
  console.log("Event created:", created);

  // Classify in the background — don't await so tab tracking isn't delayed
  if (created?.id) {
    classifyWithGemini(url, tab.title).then((category) => {
      patchEventCategory(created.id, category, session.access_token);
    });
  }

  return created?.id ?? null;
}

// ─── Patch category once Gemini responds ─────────────────────────────────────
async function patchEventCategory(eventId, category, token) {
  await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ category }),
  });
  console.log(`Category set → ${category} (event ${eventId})`);
}

// ─── Patch duration + ended_at on an existing event ─────────────────────────
async function finalizeEvent(tabId) {
  if (!activeStartTime || !tabEventMap[tabId]) return;

  const duration = Math.round((Date.now() - activeStartTime) / 1000);
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

  if (tabId === activeTabId && tabEventMap[tabId]) {
    await finalizeEvent(tabId);
    activeStartTime = Date.now();
  }

  const eventId = await createEvent(tab);
  if (eventId) {
    tabEventMap[tabId] = eventId;
    if (tabId === activeTabId) {
      activeStartTime = Date.now();
    }
  }
});

// ─── User switches tabs ──────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (activeTabId !== null && activeTabId !== tabId) {
    await finalizeEvent(activeTabId);
  }
  activeTabId = tabId;
  activeStartTime = Date.now();
});

// ─── Chrome window gains/loses focus ────────────────────────────────────────
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    if (activeTabId !== null) {
      await finalizeEvent(activeTabId);
      activeStartTime = null;
    }
  } else {
    activeStartTime = Date.now();
  }
});
