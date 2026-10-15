// Service worker entry point. All tracking lives in tracker.js.
importScripts("shared.js", "tracker.js");

// ─── Keyword classification ─────────────────────────────────────────────────
// Free and local: labels a page from its domain, then its title.
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
