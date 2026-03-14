window.RouteCraft = window.RouteCraft || {};

(function itineraryModule() {
  const RC = window.RouteCraft;

  /**
   * Sanitizes a raw array of stops, ensuring all fields are valid.
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
   * Updates stop IDs and sets transport modes correctly based on position.
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
   * Logic for adding a new stop.
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
   * Logic for deleting a stop.
   */
  function deleteStop(stops, index) {
    const newStops = [...stops];
    newStops.splice(index, 1);
    return newStops;
  }

  /**
   * Logic for reordering stops.
   */
  function reorderStops(stops, oldIndex, newIndex) {
    const newStops = [...stops];
    const [moved] = newStops.splice(oldIndex, 1);
    newStops.splice(newIndex, 0, moved);
    return newStops;
  }

  window.RouteCraft.ItineraryService = {
    sanitizeStops,
    updateStopIdsAndNextId,
    addStop,
    deleteStop,
    reorderStops
  };
})();
