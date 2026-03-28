export const SUPABASE_URL = "https://sagbrkjfdqxqndrfekkp.supabase.co";
export const SUPABASE_KEY = "sb_publishable_MGlKlUWcoPwcpDEx93n2ZQ_oQesODLJ";
export const GEMINI_API_KEY = "AIzaSyCwZvnrAeR2QhZ-NIbu9GZQQv1VeSRkXvg";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const event = {
      url: tab.url,
      title: tab.title,
      category: "uncategorized",
      duration: 0,
      created_at: new Date().toISOString(),
    };

    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(event),
    });

    console.log("Event sent to Supabase:", event);
  }
});
