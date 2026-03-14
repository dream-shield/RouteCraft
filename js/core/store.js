/**
 * @fileoverview Reactive itinerary store for RouteCraft.
 * Manages stops, active selection, and automatic persistence.
 */

(function storeModule() {
  const { reactive, watch } = Vue;
  const RC = window.RouteCraft;
  const ItineraryService = RC.ItineraryService;

  /**
   * @typedef {Object} ItineraryStore
   * @property {Stop[]} stops - Array of itinerary stops.
   * @property {number} nextId - Next unique ID for a new stop.
   * @property {number} activeIndex - Index of the currently active/focused stop.
   */

  /** @type {ItineraryStore} */
  const store = reactive({
    stops: structuredClone(RC.initialStops),
    nextId: RC.initialStops.length + 1,
    activeIndex: 0,

    /**
     * Adds a new stop to the itinerary.
     * @param {Object} formData - Data for the new stop.
     */
    addStop(formData) {
      this.stops = ItineraryService.addStop(this.stops, formData, this.nextId);
      this.nextId++;
      this.activeIndex = this.stops.length - 1;
    },

    /**
     * Deletes a stop from the itinerary by index.
     * @param {number} index - The index of the stop to remove.
     */
    deleteStop(index) {
      this.stops = ItineraryService.deleteStop(this.stops, index);
      this.activeIndex = Math.min(this.activeIndex, this.stops.length - 1);
    },

    /**
     * Updates an existing stop at a specific index.
     * @param {number} index - Index of the stop to update.
     * @param {Object} updateData - Data to merge into the stop.
     */
    updateStop(index, updateData) {
      if (index < 0 || index >= this.stops.length) return;
      this.stops[index] = {
        ...this.stops[index],
        ...updateData,
        title: (updateData.title || this.stops[index].title).trim(),
        zoomLevel: RC.clampZoom(updateData.zoomLevel || this.stops[index].zoomLevel)
      };
    },

    /**
     * Reorders a stop from one index to another.
     * @param {number} oldIndex - Original index.
     * @param {number} newIndex - New index.
     */
    reorderStops(oldIndex, newIndex) {
      if (oldIndex === newIndex) return;
      const originalActiveId = this.stops[this.activeIndex]?.id;
      
      this.stops = ItineraryService.reorderStops(this.stops, oldIndex, newIndex);
      
      // Keep the same stop active after reordering
      if (originalActiveId !== undefined) {
        this.activeIndex = this.stops.findIndex(s => s.id === originalActiveId);
      }
    },

    /**
     * Loads a full itinerary payload into the store.
     * @param {ItineraryPayload} payload - The payload to load.
     * @returns {boolean} True if data was successfully applied.
     */
    loadPayload(payload) {
      const sanitized = ItineraryService.sanitizeStops(payload?.stops);
      if (!sanitized.length) return false;

      const result = ItineraryService.updateStopIdsAndNextId(sanitized);
      this.stops = result.stops;
      this.nextId = result.nextId;
      this.activeIndex = Math.min(
        Math.max(Number(payload.activeIndex) || 0, 0),
        this.stops.length - 1
      );
      return true;
    }
  });

  /**
   * Auto-Persistence: Watch for changes and update storage.
   */
  watch(
    () => ({ stops: store.stops, activeIndex: store.activeIndex }),
    (newVal) => {
      RC.saveToLocalStorage(newVal);
      RC.setHash(newVal);
    },
    { deep: true }
  );

  window.RouteCraft.store = store;
})();
