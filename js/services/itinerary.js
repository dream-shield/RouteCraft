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
        dayId: stop.dayId || null,
        title: String(stop.title || "").trim(),
        description: String(stop.description || "").trim(),
        longitude: Number(stop.longitude),
        latitude: Number(stop.latitude),
        zoomLevel: RC.clampZoom(stop.zoomLevel),
        searchQuery: String(stop.searchQuery || stop.title || "").trim(),
        transportMode: stop.transportMode || "auto"
      }))
      .filter((stop) => stop.title && Number.isFinite(stop.longitude) && Number.isFinite(stop.latitude));
  }

  /**
   * Updates stop IDs based on their current array index and ensures
   * the first stop of each day (or the first stop overall in legacy mode) has no transport mode.
   * @param {Stop[]} stops - The array of stops to update.
   * @returns {{stops: Stop[], nextId: number}} The updated stops and the next available ID.
   */
  function updateStopIdsAndNextId(stops) {
    const seenDayIds = new Set();
    const updated = stops.map((stop, idx) => {
      const isFirstInDay = !stop.dayId || !seenDayIds.has(stop.dayId);
      if (stop.dayId) seenDayIds.add(stop.dayId);
      
      return {
        ...stop,
        id: idx + 1,
        transportMode: isFirstInDay ? null : (stop.transportMode || "auto")
      };
    });
    return {
      stops: updated,
      nextId: updated.length + 1
    };
  }

  /**
   * Creates a new day object with a default date.
   * @param {Day[]} existingDays - Currently existing days.
   * @returns {Day}
   */
  function createDay(existingDays = []) {
    const id = Math.random().toString(36).substr(2, 9);
    let date = new Date();
    
    if (existingDays.length > 0) {
      const lastDay = existingDays[existingDays.length - 1];
      date = new Date(lastDay.date);
      date.setDate(date.getDate() + 1);
    }
    
    return {
      id,
      date: date.toISOString().split('T')[0],
      description: "",
      isCollapsed: false
    };
  }

  /**
   * Handles migration of legacy flat-list payloads to the multi-day structure.
   * @param {Object} payload - The raw payload (from URL or LocalStorage).
   * @returns {Object} The migrated payload.
   */
  function migratePayload(payload) {
    if (!payload) return { stops: [], days: [] };
    
    // If it already has days, return as is (but ensure it's an array)
    if (Array.isArray(payload.days) && payload.days.length > 0) {
      return payload;
    }

    // Create a default Day 1
    const day1 = createDay([]);
    day1.description = "Day 1";
    
    const stops = Array.isArray(payload.stops) ? payload.stops : [];
    const migratedStops = stops.map(stop => ({
      ...stop,
      dayId: day1.id
    }));

    return {
      ...payload,
      days: [day1],
      stops: migratedStops,
      activeDayId: day1.id
    };
  }

  /**
   * Formats an ISO date string into a standard display format.
   * @param {string} dateStr - ISO date string (YYYY-MM-DD).
   * @returns {string} e.g., "14 Mar, Saturday"
   */
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr + 'T00:00:00'); // Ensure local time parsing
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      weekday: 'long'
    }).format(date);
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
      zoomLevel: RC.clampZoom(formData.zoomLevel),
      dayId: formData.dayId || null
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
    reorderStops,
    createDay,
    migratePayload,
    formatDate
  };
})();
