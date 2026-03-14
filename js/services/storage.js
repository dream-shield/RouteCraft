/**
 * @fileoverview Service for persistence using LocalStorage and the URL Hash.
 * Supports sharing itineraries via highly optimized compressed URL payloads.
 */

window.RouteCraft = window.RouteCraft || {};

(function storageModule() {
  const RC = window.RouteCraft;
  const STORAGE_KEY = "routecraft_itinerary_v2";
  const HASH_KEY = "data";

  /**
   * Mapping for transport modes to single-character codes.
   */
  const MODE_MAP = {
    'auto': 'a',
    'bicycle': 'b',
    'pedestrian': 'p'
  };

  /**
   * Reverse mapping for transport mode codes.
   */
  const REVERSE_MODE_MAP = {
    'a': 'auto',
    'b': 'bicycle',
    'p': 'pedestrian'
  };

  /**
   * Serializes the itinerary payload into a compact positional array format (v2).
   * Format: [v, activeIndex, activeDayId, days, [[title, desc, latInt, lonInt, modeCode, dayId], ...]]
   * @param {Object} payload - The itinerary state.
   * @returns {Array} The optimized array representation.
   */
  function serialize(payload) {
    const stops = (payload.stops || []).map(stop => [
      stop.title,
      stop.description || "",
      Math.round(stop.latitude * 1e5),
      Math.round(stop.longitude * 1e5),
      MODE_MAP[stop.transportMode] || 'a',
      stop.dayId
    ]);

    const days = (payload.days || []).map(day => [
      day.id,
      day.date,
      day.description || "",
      day.isCollapsed ? 1 : 0
    ]);

    return [
      2, // version
      payload.activeIndex || 0,
      payload.activeDayId || null,
      days,
      stops
    ];
  }

  /**
   * Deserializes the compact array format back into a full itinerary payload.
   * @param {Array} data - The optimized array data.
   * @returns {Object|null} The restored itinerary payload.
   */
  function deserialize(data) {
    if (!Array.isArray(data) || data[0] !== 2) return null;

    const [version, activeIndex, activeDayId, rawDays, rawStops] = data;

    const days = rawDays.map(d => ({
      id: d[0],
      date: d[1],
      description: d[2],
      isCollapsed: d[3] === 1
    }));

    const stops = rawStops.map((s, idx) => ({
      id: `${Date.now()}-${idx}`,
      title: s[0],
      description: s[1],
      latitude: s[2] / 1e5,
      longitude: s[3] / 1e5,
      transportMode: REVERSE_MODE_MAP[s[4]] || 'auto',
      dayId: s[5],
      zoomLevel: 12,
      searchQuery: s[0]
    }));

    return {
      version,
      stops,
      days,
      activeDayId,
      activeIndex
    };
  }

  /**
   * Persists the itinerary to the browser's LocalStorage.
   * @param {ItineraryPayload} payload - The itinerary state to save.
   */
  window.RouteCraft.saveToLocalStorage = function saveToLocalStorage(payload) {
    const data = serialize(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  /**
   * Retrieves the persisted itinerary from LocalStorage.
   * @returns {ItineraryPayload|null} The saved payload or null if not found.
   */
  window.RouteCraft.getFromLocalStorage = function getFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? deserialize(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  };

  /**
   * Encodes and compresses a payload into a URL-safe string.
   * @param {ItineraryPayload} payload - The itinerary state to encode.
   * @returns {string} The compressed payload string.
   */
  window.RouteCraft.encodePayload = function encodePayload(payload) {
    const data = serialize(payload);
    return window.LZString.compressToEncodedURIComponent(JSON.stringify(data));
  };

  /**
   * Decodes and decompresses a payload from a URL-safe string.
   * @param {string} encoded - The compressed payload string.
   * @returns {ItineraryPayload|null} The decoded itinerary state or null if parsing fails.
   */
  window.RouteCraft.decodePayload = function decodePayload(encoded) {
    try {
      const json = window.LZString.decompressFromEncodedURIComponent(encoded);
      if (!json) return null;
      const data = JSON.parse(json);
      return deserialize(data);
    } catch (e) {
      return null;
    }
  };

  /**
   * Extracts and decodes the itinerary from the current URL hash.
   * @returns {ItineraryPayload|null} The itinerary state from the URL or null if empty.
   */
  window.RouteCraft.getHashData = function getHashData() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const encoded = params.get(HASH_KEY);
    return encoded ? window.RouteCraft.decodePayload(encoded) : null;
  };

  /**
   * Updates the URL hash with a compressed version of the itinerary.
   * Uses replaceState to avoid cluttering the browser history.
   * @param {ItineraryPayload} payload - The itinerary state to serialize to the URL.
   */
  window.RouteCraft.setHash = function setHash(payload) {
    const encoded = window.RouteCraft.encodePayload(payload);
    const params = new URLSearchParams();
    params.set(HASH_KEY, encoded);
    window.history.replaceState(null, "", `#${params.toString()}`);
  };
})();
