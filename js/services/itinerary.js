/**
 * @fileoverview Service for managing itinerary state, including sanitization,
 * adding, deleting, and reordering stops.
 */

window.RouteCraft = window.RouteCraft || {};

(function itineraryModule() {
  const RC = window.RouteCraft;

  /**
   * Sanitizes a raw array of stops, ensuring all fields are valid and properly typed.
   * @param {Object[]} rawStops - The unsanitized stops from external sources.
   * @returns {Stop[]} The sanitized array of stops.
   */
  function sanitizeStops(rawStops) {
    if (!Array.isArray(rawStops)) return [];
    return rawStops
      .map((stop) => ({
        id: Number.isFinite(Number(stop.id)) ? Number(stop.id) : null,
        title: String(stop.title || "").trim(),
        description: String(stop.description || "").trim(),
        longitude: Number(stop.longitude),
        latitude: Number(stop.latitude),
        zoomLevel: RC.clampZoom(stop.zoomLevel),
        searchQuery: String(stop.searchQuery || stop.title || "").trim(),
        transportMode: stop.transportMode || (stop.id === 1 ? null : "auto")
      }))
      .filter((stop) => stop.title && Number.isFinite(stop.longitude) && Number.isFinite(stop.latitude));
  }

  /**
   * Updates stop IDs based on their current array index and ensures
   * the first stop has no transport mode.
   * @param {Stop[]} stops - The array of stops to update.
   * @returns {{stops: Stop[], nextId: number}} The updated stops and the next available ID.
   */
  function updateStopIdsAndNextId(stops) {
    const updated = stops.map((stop, idx) => ({
      ...stop,
      id: idx + 1,
      transportMode: idx === 0 ? null : (stop.transportMode || "auto")
    }));
    return {
      stops: updated,
      nextId: updated.length + 1
    };
  }

  /**
   * Logic for adding a new stop to the itinerary.
   * @param {Stop[]} stops - Current array of stops.
   * @param {Object} formData - New stop data from the UI.
   * @param {number} nextId - The ID to assign to the new stop.
   * @returns {Stop[]} A new array containing all previous stops plus the new one.
   */
  function addStop(stops, formData, nextId) {
    const newStop = {
      id: nextId,
      ...formData,
      title: formData.title.trim(),
      zoomLevel: RC.clampZoom(formData.zoomLevel)
    };
    return [...stops, newStop];
  }

  /**
   * Logic for deleting a stop from the itinerary by index.
   * @param {Stop[]} stops - Current array of stops.
   * @param {number} index - The index of the stop to remove.
   * @returns {Stop[]} A new array with the specified stop removed.
   */
  function deleteStop(stops, index) {
    const newStops = [...stops];
    newStops.splice(index, 1);
    return newStops;
  }

  /**
   * Reorders a stop within the itinerary from one index to another.
   * @param {Stop[]} stops - Current array of stops.
   * @param {number} oldIndex - The original index of the stop.
   * @param {number} newIndex - The target index for the stop.
   * @returns {Stop[]} A new array reflecting the reordered sequence.
   */
  function reorderStops(stops, oldIndex, newIndex) {
    const newStops = [...stops];
    const [moved] = newStops.splice(oldIndex, 1);
    newStops.splice(newIndex, 0, moved);
    return newStops;
  }

  /**
   * @namespace ItineraryService
   */
  window.RouteCraft.ItineraryService = {
    sanitizeStops,
    updateStopIdsAndNextId,
    addStop,
    deleteStop,
    reorderStops
  };
})();
