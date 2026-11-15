// Build a pool of real, public Odysee video claims when the page loads.
// This avoids inventing URLs: only claims returned by Odysee's public
// LBRY-compatible search endpoint are turned into iframe embed URLs.
window.odyseeVideos = [];

window.loadOdyseeVideos = async function loadOdyseeVideos() {
  const endpoint = "https://api.na-backend.odysee.com/api/v1/proxy";
  const searches = [
    "funny animals", "cats", "dogs", "comedy", "technology", "science",
    "education", "gaming", "music", "documentary", "history", "space",
    "cooking", "nature", "animation", "entertainment", "tutorial", "news"
  ];
  const pageSize = 50;
  const maxVideos = 500;
  const byClaim = new Map();

  function extractItems(payload) {
    const result = payload && payload.result;
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.items)) return result.items;
    if (result && Array.isArray(result.claims)) return result.claims;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.claims)) return payload.claims;
    return [];
  }

  async function search(text) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "claim_search",
        params: {
          text,
          claim_type: "stream",
          page: 1,
          page_size: pageSize,
          no_totals: true
        }
      })
    });
    if (!response.ok) throw new Error("Odysee search failed (" + response.status + ")");
    const payload = await response.json();
    if (payload && payload.error) throw new Error(payload.error.message || "Odysee search error");

    for (const claim of extractItems(payload)) {
      if (!claim || !claim.name || !claim.claim_id) continue;
      const value = claim.value || {};
      // claim_search can include non-video streams; retain only video claims.
      if (!value.video && value.stream_type !== "video" && claim.media_type !== "video") continue;
      const key = claim.claim_id;
      if (byClaim.has(key)) continue;
      const title = value.title || claim.title || claim.name;
      byClaim.set(key, {
        name: title,
        url: "https://odysee.com/$/embed/" + encodeURIComponent(claim.name) + ":" + encodeURIComponent(claim.claim_id)
      });
    }
  }

  // Keep the number of simultaneous requests low and continue through
  // individual API errors; successful searches still contribute results.
  for (let i = 0; i < searches.length; i += 3) {
    await Promise.all(searches.slice(i, i + 3).map((term) =>
      search(term).catch((error) => console.warn("Odysee search skipped:", term, error))
    ));
    if (byClaim.size >= maxVideos) break;
  }

  window.odyseeVideos = Array.from(byClaim.values()).slice(0, maxVideos);
  return window.odyseeVideos;
};
