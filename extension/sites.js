// Built-in site → category rules. Classic script (no import/export), loaded
// before shared.js in the service worker and in the pages.
//
// lookup(hostname) checks, in order:
//   1. the hostname and each parent domain against SITES ("a.b.example.com",
//      "b.example.com", "example.com") — the most specific match wins
//   2. PREFIXES, e.g. "canvas.<school>.edu"
//   3. any ".edu" domain → learning
// Returns { category, mixed } or null. `mixed` sites (YouTube…) serve both
// learning and entertainment, so the page title gets a say first and the
// category here is only the fallback.
//
// To add a site, add a line below. Keys must be categories from shared.js.

const MINDMAP_SITES = (() => {
  const L = 'learning', E = 'entertainment', P = 'productivity', N = 'news', S = 'social media';

  const SITES = {
    // ── Learning: school & courses ────────────────────────────────────────
    'instructure.com': L, 'blackboard.com': L, 'gradescope.com': L, 'piazza.com': L,
    'edstem.org': L, 'coursera.org': L, 'udemy.com': L, 'edx.org': L, 'khanacademy.org': L,
    'codecademy.com': L, 'datacamp.com': L, 'pluralsight.com': L, 'skillshare.com': L,
    'brilliant.org': L, 'duolingo.com': L, 'quizlet.com': L, 'chegg.com': L,
    'coursehero.com': L, 'studocu.com': L, 'masterclass.com': L, 'ted.com': L,
    'notebooklm.google.com': L,
    // ── Learning: coding practice & docs ──────────────────────────────────
    'leetcode.com': L, 'neetcode.io': L, 'hackerrank.com': L, 'codewars.com': L,
    'codeforces.com': L, 'kaggle.com': L, 'stackoverflow.com': L, 'stackexchange.com': L,
    'superuser.com': L, 'serverfault.com': L, 'askubuntu.com': L,
    'github.com': L, 'gitlab.com': L, 'developer.mozilla.org': L, 'w3schools.com': L,
    'geeksforgeeks.org': L, 'freecodecamp.org': L, 'dev.to': L, 'medium.com': L,
    'realpython.com': L, 'tutorialspoint.com': L, 'programiz.com': L, 'cppreference.com': L,
    'python.org': L, 'react.dev': L, 'nodejs.org': L, 'rust-lang.org': L, 'go.dev': L,
    'pytorch.org': L, 'tensorflow.org': L, 'huggingface.co': L, 'roadmap.sh': L,
    // ── Learning: reference & research ────────────────────────────────────
    'wikipedia.org': L, 'britannica.com': L, 'arxiv.org': L, 'scholar.google.com': L,
    'jstor.org': L, 'researchgate.net': L, 'sciencedirect.com': L, 'springer.com': L,
    'nature.com': L, 'ncbi.nlm.nih.gov': L, 'semanticscholar.org': L,
    'wolframalpha.com': L, 'desmos.com': L, 'symbolab.com': L, 'mathway.com': L,
    'overleaf.com': L,

    // ── Productivity: work, docs, tools ───────────────────────────────────
    'mail.google.com': P, 'calendar.google.com': P, 'docs.google.com': P,
    'drive.google.com': P, 'keep.google.com': P, 'meet.google.com': P,
    'outlook.com': P, 'outlook.live.com': P, 'outlook.office.com': P, 'office.com': P,
    'teams.microsoft.com': P, 'onedrive.live.com': P, 'zoom.us': P,
    'notion.so': P, 'notion.site': P, 'slack.com': P, 'atlassian.net': P,
    'trello.com': P, 'asana.com': P, 'linear.app': P, 'clickup.com': P, 'monday.com': P,
    'airtable.com': P, 'todoist.com': P, 'evernote.com': P, 'obsidian.md': P,
    'calendly.com': P, 'dropbox.com': P, 'box.com': P, 'icloud.com': P,
    'figma.com': P, 'canva.com': P, 'miro.com': P, 'grammarly.com': P,
    'chatgpt.com': P, 'claude.ai': P, 'gemini.google.com': P, 'perplexity.ai': P,
    'replit.com': P, 'codepen.io': P, 'codesandbox.io': P, 'vercel.com': P,
    'netlify.com': P, 'console.cloud.google.com': P, 'portal.azure.com': P,
    'console.aws.amazon.com': P,
    'handshake.com': P, 'joinhandshake.com': P, 'indeed.com': P, 'glassdoor.com': P,

    // ── News ──────────────────────────────────────────────────────────────
    'bbc.com': N, 'bbc.co.uk': N, 'cnn.com': N, 'nytimes.com': N, 'reuters.com': N,
    'theguardian.com': N, 'washingtonpost.com': N, 'bloomberg.com': N, 'apnews.com': N,
    'aljazeera.com': N, 'npr.org': N, 'wsj.com': N, 'ft.com': N, 'economist.com': N,
    'axios.com': N, 'politico.com': N, 'nbcnews.com': N, 'cbsnews.com': N,
    'abcnews.go.com': N, 'foxnews.com': N, 'usatoday.com': N, 'latimes.com': N,
    'theatlantic.com': N, 'newyorker.com': N, 'vox.com': N, 'time.com': N,
    'cnbc.com': N, 'forbes.com': N, 'businessinsider.com': N, 'semafor.com': N,
    'techcrunch.com': N, 'theverge.com': N, 'wired.com': N, 'arstechnica.com': N,
    'engadget.com': N, 'news.ycombinator.com': N, 'news.google.com': N,

    // ── Social media ──────────────────────────────────────────────────────
    'twitter.com': S, 'x.com': S, 'instagram.com': S, 'facebook.com': S,
    'messenger.com': S, 'tiktok.com': S, 'linkedin.com': S, 'reddit.com': S,
    'snapchat.com': S, 'pinterest.com': S, 'threads.net': S, 'bsky.app': S,
    'mastodon.social': S, 'discord.com': S, 'tumblr.com': S, 'quora.com': S,
    'web.whatsapp.com': S, 'web.telegram.org': S, 'nextdoor.com': S,

    // ── Entertainment ─────────────────────────────────────────────────────
    'netflix.com': E, 'hulu.com': E, 'disneyplus.com': E, 'max.com': E,
    'primevideo.com': E, 'peacocktv.com': E, 'paramountplus.com': E, 'crunchyroll.com': E,
    'tv.apple.com': E, 'music.apple.com': E, 'spotify.com': E, 'soundcloud.com': E,
    'pandora.com': E, 'deezer.com': E, 'tidal.com': E, 'twitch.tv': E, 'kick.com': E,
    'store.steampowered.com': E, 'steamcommunity.com': E, 'epicgames.com': E,
    'roblox.com': E, 'chess.com': E, 'lichess.org': E, 'ign.com': E, 'kotaku.com': E,
    'gamespot.com': E, 'espn.com': E, 'nba.com': E, 'nfl.com': E,
    'imdb.com': E, 'letterboxd.com': E, 'rottentomatoes.com': E, 'fandom.com': E,
    '9gag.com': E, 'imgur.com': E, 'buzzfeed.com': E, 'knowyourmeme.com': E,
    'webtoons.com': E, 'archiveofourown.org': E,
  };

  // Mixed sites: the title decides when it can ("…tutorial" → learning);
  // otherwise they fall back to this category instead of "other".
  const MIXED = {
    'youtube.com': E, 'm.youtube.com': E, 'vimeo.com': E, 'dailymotion.com': E,
  };

  const PREFIXES = [
    [/^canvas\./, L], [/^moodle\./, L], [/^blackboard\./, L], [/^elearning\./, L],
    [/^docs\./, L], [/^developer\./, L], [/^learn\./, L],
  ];

  function lookup(hostname) {
    const host = (hostname || '').toLowerCase().replace(/^www\./, '');
    if (!host) return null;

    const labels = host.split('.');
    for (let i = 0; i < labels.length - 1; i++) {
      const d = labels.slice(i).join('.');
      if (d in SITES) return { category: SITES[d], mixed: false };
      if (d in MIXED) return { category: MIXED[d], mixed: true };
    }
    for (const [re, category] of PREFIXES) if (re.test(host)) return { category, mixed: false };
    if (host.endsWith('.edu')) return { category: L, mixed: false };
    return null;
  }

  return { lookup };
})();
