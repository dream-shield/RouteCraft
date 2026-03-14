/**
 * @fileoverview Service for persistence using LocalStorage and the URL Hash.
 * Supports sharing itineraries via compressed URL payloads.
 */

window.RouteCraft = window.RouteCraft || {};

(function storageModule() {
  const STORAGE_KEY = "routecraft_itinerary_v1";
  const HASH_KEY = "data";

  /**
   * Persists the itinerary to the browser's LocalStorage.
   * @param {ItineraryPayload} payload - The itinerary state to save.
   */
  window.RouteCraft.saveToLocalStorage = function saveToLocalStorage(payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  /**
   * Retrieves the persisted itinerary from LocalStorage.
   * @returns {ItineraryPayload|null} The saved payload or null if not found.
   */
  window.RouteCraft.getFromLocalStorage = function getFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
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
    return window.LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  };

  /**
   * Decodes and decompresses a payload from a URL-safe string.
   * @param {string} encoded - The compressed payload string.
   * @returns {ItineraryPayload|null} The decoded itinerary state or null if parsing fails.
   */
  window.RouteCraft.decodePayload = function decodePayload(encoded) {
    try {
      const json = window.LZString.decompressFromEncodedURIComponent(encoded);
      return json ? JSON.parse(json) : null;
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
