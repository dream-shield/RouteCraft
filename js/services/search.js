/**
 * @fileoverview Service for location search and geocoding.
 * Supports multiple interchangeable providers (Nominatim, Photon).
 */

window.RouteCraft = window.RouteCraft || {};

(function searchModule() {
  const RC = window.RouteCraft;

  /**
   * Normalizes text for better comparison and scoring.
   */
  function normalizeText(value) {
    return (value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Shared scoring logic to enhance relevance across different providers.
   */
  function scoreResult(result, rawQuery) {
    const queryNorm = normalizeText(rawQuery);
    const compactQuery = queryNorm.replace(/\s+/g, "");
    const name = normalizeText(result.display_name || "");
    const compactName = name.replace(/\s+/g, "");

    let score = 0;
    if (name.startsWith(queryNorm)) score += 200;
    if (name.includes(queryNorm)) score += 120;
    if (compactQuery && compactName.includes(compactQuery)) score += 100;

    // Add a boost based on the provider's reported importance
    score += (result.importance || 0) * 100;

    return score;
  }

  /**
   * PHOTON PROVIDER: Fast OSM-based search by Komoot.
   */
  const PhotonProvider = {
    async search(query) {
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=12&lang=en`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) return [];
      const payload = await response.json();
      const features = Array.isArray(payload?.features) ? payload.features : [];

      return features.map((feature) => {
        const props = feature?.properties || {};
        const coords = feature?.geometry?.coordinates || [];
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const nameParts = [props.name, props.street, props.city, props.state, props.country].filter(Boolean);
        const kind = String(props.osm_key || "").toLowerCase();
        const importance = ["tourism", "amenity", "place"].includes(kind) ? 0.8 : 0.45;

        return {
          place_id: `photon:${props.osm_type || "u"}:${props.osm_id || Math.random()}`,
          display_name: nameParts.join(", "),
          lat: String(lat),
          lon: String(lon),
          importance: importance,
          raw: feature
        };
      }).filter(Boolean);
    }
  };

  /**
   * NOMINATIM PROVIDER: Official OpenStreetMap search (Highly reliable ranking).
   */
  const NominatimProvider = {
    async search(query) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&addressdetails=1`,
        { headers: { Accept: "application/json", "User-Agent": "RouteCraft/1.0" } }
      );

      if (!response.ok) return [];
      const items = await response.json();

      return items.map((item) => ({
        place_id: `nominatim:${item.place_id || item.osm_id}`,
        display_name: item.display_name,
        lat: item.lat,
        lon: item.lon,
        importance: Number(item.importance) || 0.5,
        raw: item
      }));
    }
  };

  /**
   * PROVIDER REGISTRY
   */
  const providers = {
    nominatim: NominatimProvider,
    photon: PhotonProvider
  };

  /** @type {string} Active provider key */
  let activeProvider = "nominatim";

  /**
   * Fetches location suggestions for a query string.
   * @param {string} query - The search query.
   * @returns {Promise<Object[]>} Top relevant suggestions.
   */
  RC.fetchSuggestions = async function fetchSuggestions(query) {
    const rawQuery = query.trim();
    if (!rawQuery) return [];

    try {
      const provider = providers[activeProvider];
      if (!provider) throw new Error(`Search provider "${activeProvider}" not found.`);

      const results = await provider.search(rawQuery);
      if (!results.length) return [];

      // Deduplicate and re-score using local logic for consistency
      const deduped = Array.from(new Map(results.map((item) => [item.place_id, item])).values());
      deduped.sort((a, b) => scoreResult(b, rawQuery) - scoreResult(a, rawQuery));

      return deduped.slice(0, 10);
    } catch (error) {
      console.error("Search Service Error:", error);
      return [];
    }
  };

  /**
   * Changes the active search provider.
   * @param {string} providerKey - Key in the providers registry (e.g. 'photon', 'nominatim').
   */
  RC.setSearchProvider = function setSearchProvider(providerKey) {
    if (providers[providerKey]) {
      activeProvider = providerKey;
      console.log(`Search provider switched to: ${providerKey}`);
    }
  };
})();

