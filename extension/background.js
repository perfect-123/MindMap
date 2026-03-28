const SUPABASE_URL = "https://sagbrkjfdqxqndrfekkp.supabase.co";
const SUPABASE_KEY = "sb_publishable_MGlKlUWcoPwcpDEx93n2ZQ_oQesODLJ";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const event = {
      url: tab.url,
      title: tab.title,
      category: "uncategorized",
      duration: 0,
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
