importScripts("shared.js"); // MINDMAP

const { SUPABASE_URL, SUPABASE_KEY } = MINDMAP;

// ─── In-memory state ────────────────────────────────────────────────────────
let activeTabId = null;
let activeStartTime = null;
const tabEventMap = {}; // tabId → supabase event id

// ─── Auth ────────────────────────────────────────────────────────────────────
async function getOrCreateSession() {
  const stored = await chrome.storage.local.get("supabase_session");
  const session = stored.supabase_session;

  if (session?.access_token) {
    // expires_at is a Unix timestamp in seconds — refresh 60s before expiry
    const expired = session.expires_at && session.expires_at * 1000 < Date.now() + 60_000;

    if (!expired) return session;

    // Token expired — use refresh_token to get a new one without creating a new user
    if (session.refresh_token) {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });
        const refreshed = await res.json();
        if (refreshed.access_token) {
          await chrome.storage.local.set({ supabase_session: refreshed });
          return refreshed;
        }
      } catch (err) {
        console.warn("Token refresh failed, signing up fresh:", err);
      }
    }
  }

  // No session or refresh failed — create a new anonymous user
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

// New tab page asks for the session here instead of keeping its own copy
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "getSession") return;
  getOrCreateSession().then(sendResponse, () => sendResponse(null));
  return true; // keep the channel open for the async response
});

// ─── Provisional keyword classification ─────────────────────────────────────
// Free and local. Gives today's score something to show; a daily server-side
// batch is meant to replace these labels with AI classifications.
function classifyLocally(url, title) {
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {}
  const text = (domain + " " + title).toLowerCase();

  const SOCIAL =
    /\b(twitter\.com|x\.com|instagram\.com|facebook\.com|tiktok\.com|linkedin\.com|reddit\.com|snapchat\.com|pinterest\.com|threads\.net)\b/;
  const NEWS =
    /\b(bbc\.(co\.uk|com)|cnn\.com|nytimes\.com|reuters\.com|theguardian\.com|washingtonpost\.com|bloomberg\.com|apnews\.com|aljazeera\.com|techcrunch\.com|theverge\.com|wired\.com)\b/;
  const LEARN =
    /\b(wikipedia\.org|stackoverflow\.com|github\.com|docs\.|coursera\.org|udemy\.com|khanacademy\.org|edx\.org|medium\.com|dev\.to|freecodecamp\.org|w3schools\.com|mdn\b|developer\.|learn\.|education)\b/;
  const PROD =
    /\b(gmail\.com|notion\.so|slack\.com|jira\.|linear\.app|figma\.com|docs\.google\.com|sheets\.google\.com|trello\.com|asana\.com|calendar\.google\.com|outlook\.(com|office\.com))\b/;
  const ENTERTAIN =
    /\b(netflix\.com|twitch\.tv|spotify\.com|soundcloud\.com|9gag\.com|imgur\.com|primevideo\.com|disneyplus\.com|hulu\.com)\b/;

  if (SOCIAL.test(domain)) return "social media";
  if (NEWS.test(domain)) return "news";
  if (ENTERTAIN.test(domain)) return "entertainment";
  if (PROD.test(domain)) return "productivity";
  if (LEARN.test(domain)) return "learning";

  if (
    /tutorial|course|lecture|documentation|how[ -]to|explained?|guide|learn\b/.test(
      text,
    )
  )
    return "learning";
  if (/breaking news|headlines|politics|report\b/.test(text)) return "news";
  if (/\bgame\b|gaming|meme|funny|comedy/.test(text)) return "entertainment";

  return "other";
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
      category: classifyLocally(url, tab.title || ""), // provisional — see classifyLocally
      duration: 0,
      domain,
      user_id: session.user?.id,
      created_at: new Date().toISOString(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Supabase insert failed:", data);
    return null;
  }
  const [created] = data;
  console.log("Event created:", created);

  return created?.id ?? null;
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
