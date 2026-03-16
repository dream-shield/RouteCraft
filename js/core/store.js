/**
 * @fileoverview Reactive itinerary store for RouteCraft.
 * Manages stops, active selection, and automatic persistence.
 */

(function storeModule() {
  const { reactive, watch } = Vue;
  const RC = window.RouteCraft;
  const ItineraryService = RC.ItineraryService;

  /**
   * @typedef {Object} Day
   * @property {string} id - Unique ID for the day.
   * @property {string} date - ISO date string.
   * @property {string} description - Optional description for the day.
   * @property {boolean} isCollapsed - Whether the day section is collapsed in the UI.
   */

  /**
   * @typedef {Object} ItineraryStore
   * @property {Stop[]} stops - Array of itinerary stops.
   * @property {Day[]} days - Array of itinerary days.
   * @property {string|null} activeDayId - ID of the currently active/focused day.
   * @property {number} activeIndex - Index of the currently active/focused stop.
   * @property {string|number|null} editingStopId - ID of the stop currently being edited.
   * @property {Object} editForm - Temporary state for the edit form.
   */

  /** @type {ItineraryStore} */
  const store = reactive({
    stops: [],
    days: [],
    activeDayId: null,
    activeIndex: 0,
    editingStopId: null,
    editForm: RC.createEmptyForm(),

    /**
     * Returns the days sorted by date.
     * @returns {Day[]}
     */
    get sortedDays() {
      return [...this.days].sort((a, b) => a.date.localeCompare(b.date));
    },

    /**
     * Returns all stops for the currently active day.
     * @returns {Stop[]}
     */
    get stopsForActiveDay() {
      if (!this.activeDayId) return this.stops;
      return this.stops.filter(s => s.dayId === this.activeDayId);
    },

    /**
     * Ensures the global 'stops' array matches the chronological order of days.
     * This is critical for routing, which expects contiguous stops for each day.
     */
    sortStopsByDay() {
      const sortedDays = this.sortedDays;
      const dayOrder = sortedDays.map(d => d.id);
      
      const activeId = this.stops[this.activeIndex]?.id;

      // Use a stable sort to maintain relative order within the same day
      this.stops.sort((a, b) => {
        const idxA = dayOrder.indexOf(a.dayId);
        const idxB = dayOrder.indexOf(b.dayId);
        return idxA - idxB;
      });

      // Restore active index if the active stop moved
      if (activeId !== undefined) {
        const newIdx = this.stops.findIndex(s => s.id === activeId);
        if (newIdx !== -1) this.activeIndex = newIdx;
      }
    },

    /**
     * Adds a new stop to the itinerary.
     * @param {Object} formData - Data for the new stop.
     */
    addStop(formData) {
      const dayId = formData.dayId || this.activeDayId || (this.days[0] && this.days[0].id);
      const stopId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Initial transport mode: auto if there's already a stop in this day, else null
      const hasStopsInDay = this.stops.some(s => s.dayId === dayId);
      
      const newStop = { 
        ...formData, 
        id: stopId, 
        dayId, 
        title: formData.title.trim(),
        transportMode: hasStopsInDay ? (formData.transportMode || "auto") : null
      };

      this.stops.push(newStop);
      this.sortStopsByDay();
      
      // Select the newly added stop
      this.activeIndex = this.stops.findIndex(s => s.id === stopId);
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
        title: (updateData.title || this.stops[index].title).trim()
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
     * Adds a new day to the itinerary.
     */
    addDay() {
      const newDay = ItineraryService.createDay(this.days);
      this.days.push(newDay);
      if (!this.activeDayId) this.activeDayId = newDay.id;
    },

    /**
     * Deletes a day and its associated stops.
     * @param {string} dayId - The ID of the day to remove.
     */
    deleteDay(dayId) {
      if (this.days.length <= 1) return;
      this.days = this.days.filter(d => d.id !== dayId);
      this.stops = this.stops.filter(s => s.dayId !== dayId);
      if (this.activeDayId === dayId) {
        this.activeDayId = this.days[0].id;
      }
      this.activeIndex = Math.min(this.activeIndex, this.stops.length - 1);
    },

    /**
     * Updates a day's properties.
     * @param {string} dayId - The ID of the day to update.
     * @param {Object} updateData - Data to merge into the day.
     */
    updateDay(dayId, updateData) {
      const day = this.days.find(d => d.id === dayId);
      if (day) {
        Object.assign(day, updateData);
        // If the date changed, re-sort stops to match new day order
        if (updateData.date) {
          this.sortStopsByDay();
        }
      }
    },

    /**
     * Loads a full itinerary payload into the store.
     * @param {ItineraryPayload} payload - The payload to load.
     * @returns {boolean} True if data was successfully applied.
     */
    loadPayload(payload) {
      const ItineraryService = window.RouteCraft.ItineraryService;

      // Handle migration of legacy flat lists
      const migrated = ItineraryService.migratePayload(payload);

      const sanitizedStops = ItineraryService.sanitizeStops(migrated.stops);
      if (!sanitizedStops.length) return false;

      this.stops = sanitizedStops;
      this.days = migrated.days || [];
      this.activeDayId = migrated.activeDayId || (this.days[0] && this.days[0].id) || null;

      // Ensure stops are correctly ordered on load for routing
      this.sortStopsByDay();

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
    () => ({
      stops: store.stops,
      days: store.days,
      activeDayId: store.activeDayId,
      activeIndex: store.activeIndex
    }),
    (newVal) => {
      RC.saveToLocalStorage(newVal);
      RC.setHash(newVal);
    },
    { deep: true }
  );

  window.RouteCraft.store = store;
})();
