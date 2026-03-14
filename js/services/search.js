window.RouteCraft = window.RouteCraft || {};

(function searchModule() {
  function normalizeText(value) {
    return value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreResult(result, rawQuery) {
    const queryNorm = normalizeText(rawQuery);
    const compactQuery = queryNorm.replace(/\s+/g, "");
    const name = normalizeText(result.display_name || "");
    const compactName = name.replace(/\s+/g, "");

    let score = 0;
    if (name.startsWith(queryNorm)) score += 200;
    if (name.includes(queryNorm)) score += 120;
    if (compactQuery && compactName.includes(compactQuery)) score += 100;
    if ((result.display_name || "").toLowerCase().includes("disneyland")) score += 40;
    score += Number(result.importance || 0) * 25;

    return score;
  }

  async function searchVariant(queryVariant) {
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(queryVariant)}&limit=12&lang=en`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) return [];
    const payload = await response.json();
    const features = Array.isArray(payload?.features) ? payload.features : [];

    return features
      .map((feature) => {
        const props = feature?.properties || {};
        const coords = feature?.geometry?.coordinates || [];
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const nameParts = [
          props.name,
          props.street,
          props.city,
          props.state,
          props.country
        ].filter(Boolean);

        const displayName = nameParts.join(", ");
        const placeId = `${props.osm_type || "unknown"}:${props.osm_id || displayName}`;
        const kind = String(props.osm_key || "").toLowerCase();
        const baseImportance = ["tourism", "amenity", "place"].includes(kind) ? 0.8 : 0.45;

        return {
          place_id: placeId,
          display_name: displayName || props.name || queryVariant,
          lat: String(lat),
          lon: String(lon),
          importance: baseImportance
        };
      })
      .filter(Boolean);
  }

  window.RouteCraft.fetchSuggestions = async function fetchSuggestions(query) {
    const normalized = query.trim();
    if (!normalized) return [];

    const compact = normalized.replace(/\s+/g, "");
    const variants = compact !== normalized ? [normalized, compact] : [normalized];

    const allResults = (await Promise.all(variants.map((variant) => searchVariant(variant)))).flat();
    if (!allResults.length) return [];

    const deduped = Array.from(new Map(allResults.map((item) => [item.place_id, item])).values());
    deduped.sort((a, b) => scoreResult(b, normalized) - scoreResult(a, normalized));

    return deduped.slice(0, 10);
  };
})();
