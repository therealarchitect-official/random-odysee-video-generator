// Fetch real video claims from Odysee's public LBRY-compatible search API.
// This creates a pool at runtime rather than pretending repeated URLs are
// different videos. Results are deduplicated by claim ID.
window.odyseeVideos = [];

window.loadOdyseeVideos = async function loadOdyseeVideos() {
  const endpoint = "https://api.na-backend.odysee.com/api/v1/proxy";
  const queries = [
    "funny animals", "cats", "dogs", "comedy", "technology", "science",
    "education", "gaming", "music", "documentary", "history", "space",
    "cooking", "nature", "animation", "entertainment", "tutorial", "news",
    "art", "travel", "DIY", "sports", "books", "movies"
  ];
  const pageSize = 50;
  const videosByClaimId = new Map();

  function getClaims(payload) {
    const result = payload && payload.result;
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.items)) return result.items;
    if (result && Array.isArray(result.claims)) return result.claims;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.claims)) return payload.claims;
    return [];
  }

  async function search(query) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "claim_search",
        params: {
          text: query,
          claim_type: "stream",
          media_type: "video",
          page: 1,
          page_size: pageSize,
          no_totals: true
        })
      })
    });
    if (!response.ok) throw new Error("Search HTTP " + response.status);

    const payload = await response.json();
    if (payload && payload.error) {
      throw new Error(payload.error.message || "Odysee search returned an error");
    }

    for (const claim of getClaims(payload)) {
      if (!claim || !claim.name || !claim.claim_id) continue;
      const value = claim.value || {};
      const metadata = value.video || value.metadata?.video;
      const contentType = value.source?.media_type || value.content_type || "";
      const isVideo = Boolean(
        metadata || claim.media_type === "video" || value.media_type === "video" ||
        value.stream_type === "video" || String(contentType).startsWith("video/")
      );
      if (!isVideo) continue;

      const id = claim.claim_id;
      if (videosByClaimId.has(id)) continue;
      const title = (metadata && metadata.title) || value.title || claim.title || claim.name;
      videosByClaimId.set(id, {
        name: title,
        url: "https://odysee.com/$/embed/" + encodeURIComponent(claim.name) + ":" + encodeURIComponent(id)
      });
    }
  }

  // Fetch in small batches to avoid firing dozens of requests simultaneously.
  const batchSize = 3;
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(search));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn("Odysee search failed for '" + batch[index] + "':", result.reason);
      }
    });
  }

  window.odyseeVideos = Array.from(videosByClaimId.values());
  return window.odyseeVideos;
};
