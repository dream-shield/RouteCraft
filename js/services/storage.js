window.RouteCraft = window.RouteCraft || {};

(function storageModule() {
  const STORAGE_KEY = "routecraft_itinerary_v1";
  const HASH_KEY = "data";

  window.RouteCraft.saveToLocalStorage = function saveToLocalStorage(payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  window.RouteCraft.getFromLocalStorage = function getFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  window.RouteCraft.encodePayload = function encodePayload(payload) {
    return window.LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  };

  window.RouteCraft.decodePayload = function decodePayload(encoded) {
    try {
      const json = window.LZString.decompressFromEncodedURIComponent(encoded);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      return null;
    }
  };

  window.RouteCraft.getHashData = function getHashData() {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const encoded = params.get(HASH_KEY);
    return encoded ? window.RouteCraft.decodePayload(encoded) : null;
  };

  window.RouteCraft.setHash = function setHash(payload) {
    const encoded = window.RouteCraft.encodePayload(payload);
    const params = new URLSearchParams();
    params.set(HASH_KEY, encoded);
    window.history.replaceState(null, "", `#${params.toString()}`);
  };
})();
