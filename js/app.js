/**
 * @fileoverview Main entry point for the RouteCraft application.
 * Initializes the Vue.js app, integrates the reactive store,
 * and coordinates between mapping and UI components.
 */

(function appModule() {
  const { createApp, nextTick } = Vue;
  const RC = window.RouteCraft;
  const store = RC.store;

  createApp({
    components: {
      'place-card': window.PlaceCard,
      'day-header': window.DayHeader,
      'add-stop-menu': window.AddStopMenu,
      'local-data-toast': window.LocalDataToast
    },
    data() {
      return {
        // Reference the global reactive store
        store,

        /** @type {Object|null} The MapLibre Map instance */
        map: null,
        /** @type {boolean} True if the map has finished loading */
        mapLoaded: false,
        /** @type {Object[]} Array of rendered MapLibre markers */
        markers: [],
        /** @type {string[]} Colors used for route segments and markers */
        routeColors: [
          "#2563EB", "#06B6D4", "#F97316", "#8B5CF6", "#16A34A",
          "#E11D48", "#F59E0B", "#0EA5E9", "#A855F7", "#14B8A6",
          "#EF4444", "#22C55E"
        ],

        /** @type {boolean} State of the Add Place menu */
        addMenuOpen: false,
        /** @type {string|null} ID of the day currently being added to */
        activeAddDayId: null,

        /** @type {boolean} Visibility of the local data toast */
        showLocalDataToast: false,
        /** @type {ItineraryPayload|null} Data found in the URL hash */
        pendingUrlData: null,
        /** @type {ItineraryPayload|null} Data found in LocalStorage */
        pendingLocalData: null,

        /** @type {string} Stadia Maps API key for routing */
        stadiaApiKey: "613372b7-785f-4b4e-9df1-0ca400312a1a",
        /** @type {number[][][]} Cached geometries for each route segment */
        routeGeometries: []
      };
    },

    computed: {
      // Shorthand aliases to store properties
      stops() { return this.store.stops; },
      activeIndex() { return this.store.activeIndex; },
      activeDayId() { return this.store.activeDayId; },
      editingStopId() { return this.store.editingStopId; },
      editForm() { return this.store.editForm; },
      stopsForActiveDay() { return this.store.stopsForActiveDay; }
    },

    methods: {
      /** Restores data from LocalStorage when the user clicks the toast action. */
      restoreLocalData() {
        if (this.pendingLocalData) {
          if (this.store.loadPayload(this.pendingLocalData)) {
            this.flyToStop(this.activeIndex, false);
          }
        }
        this.showLocalDataToast = false;
      },

      /** Dismisses the local data toast. */
      dismissLocalData() {
        this.showLocalDataToast = false;
        this.pendingLocalData = null;
      },

      /** Copies a shareable link (URL with encoded hash) to the clipboard. */
      copyShareLink() {
        const url = window.location.href;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(url);
        } else {
          window.prompt("Copy this link:", url);
        }
      },

      /** Triggers a browser download of the itinerary in KML format. */
      exportKml() {
        if (!this.stops.length) return alert("No stops to export.");
        const kml = RC.generateKml(this.stops);
        const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "routecraft-itinerary.kml"; a.click();
        URL.revokeObjectURL(url);
      },

      /** Triggers the hidden file input for KML import. */
      triggerKmlImport() { this.$refs.kmlFileInput.click(); },

      /**
       * Handles a KML file selection and parses it into the itinerary.
       * @param {Event} event - The file input change event.
       */
      async importKmlFile(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const placemarks = RC.parseKml(text);
          if (!placemarks) return alert("No valid stops found in KML.");

          this.store.loadPayload({ stops: placemarks, activeIndex: 0 });
          this.flyToStop(this.stops[0].id, false);
        } catch (e) { alert("Failed to import KML."); }
        event.target.value = "";
      },

      /** Initializes the MapLibre map instance. */
      initMap() {
        const firstStop = this.stops[0] || { longitude: -98.58, latitude: 39.82, zoomLevel: 3.8 };
        this.map = RC.createMap(window.maplibregl, "map", firstStop);
        this.map.on("load", () => {
          this.mapLoaded = true;
          // Initial map fit
          const dayStops = this.getStopsForDay(this.activeDayId);
          if (dayStops.length > 0) {
            RC.fitToDayStops(this.map, dayStops);
          }
        });
      },

      /** Synchronizes the current stop data with the map's markers and route lines. */
      syncMapData() {
        if (!this.mapLoaded) return;

        const activeStopId = this.stops[this.activeIndex]?.id;
        this.markers = RC.renderMarkers(window.maplibregl, this.map, this.stopsForActiveDay, this.markers, activeStopId, this.routeColors);
        RC.refreshRouteLayer(this.map, this.stopsForActiveDay, this.routeColors, this.routeGeometries, this.stops);
      },

      /** Fetches updated route geometries for all segments in the itinerary. */
      async updateRouteGeometries() {
        const geometries = [];
        for (let i = 0; i < this.stops.length - 1; i++) {
          const origin = this.stops[i];
          const destination = this.stops[i + 1];

          if (origin.dayId === destination.dayId) {
            const mode = destination.transportMode || "auto";
            geometries.push(await RC.fetchRouteSegment(origin, destination, mode, this.stadiaApiKey));
          } else {
            geometries.push(null);
          }
        }
        this.routeGeometries = geometries;
      },

      /**
       * Sets the transport mode for a specific segment.
       * @param {string|number} stopId - ID of the destination stop for the segment.
       * @param {TransportMode} mode - The new transport mode.
       */
      async setSegmentMode(stopId, mode) {
        const idx = this.stops.findIndex(s => s.id === stopId);
        if (idx !== -1) {
          this.store.updateStop(idx, { transportMode: mode });
        }
      },

      /**
       * Focuses the map on a specific stop.
       * @param {string|number} stopId - The ID of the stop to focus.
       * @param {boolean} [shouldScroll=true] - Whether to scroll the sidebar card into view.
       */
      flyToStop(stopId, shouldScroll = true) {
        const index = this.stops.findIndex(s => s.id === stopId);
        if (index === -1) return;

        this.store.activeIndex = index;
        if (this.mapLoaded) {
          RC.flyToStop(this.map, this.stops[index]);
        }
        if (shouldScroll) {
          nextTick(() => {
            document.getElementById(`card-${stopId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      },

      /** Navigates to the previous stop in the itinerary. */
      goPrev() {
        if (this.activeIndex > 0) {
          this.flyToStop(this.stops[this.activeIndex - 1].id);
        }
      },
      /** Navigates to the next stop in the itinerary. */
      goNext() {
        if (this.activeIndex < this.stops.length - 1) {
          this.flyToStop(this.stops[this.activeIndex + 1].id);
        }
      },

      /** Toggles the visibility of the Add Place menu for a specific day. */
      toggleAddMenuForDay(dayId) {
        const isCurrentlyOpenForThisDay = this.addMenuOpen && this.activeAddDayId === dayId;

        if (isCurrentlyOpenForThisDay) {
          this.closeAddMenu();
        } else {
          // Ensure the day is expanded and active
          this.store.updateDay(dayId, { isCollapsed: false });
          this.store.activeDayId = dayId;

          this.activeAddDayId = dayId;
          this.addMenuOpen = true;
        }
      },

      /** Closes the add menu and resets state. */
      closeAddMenu() {
        this.addMenuOpen = false;
        this.activeAddDayId = null;
      },

      /**
       * Callback for when the AddStopMenu component emits a new stop.
       * @param {Object} formData - Data for the new stop.
       */
      onComponentAddStop(formData) {
        // Ensure the stop is added to the day where the button was clicked
        if (this.activeAddDayId) {
          formData.dayId = this.activeAddDayId;
        }
        this.store.addStop(formData);
        const newStop = this.stops[this.stops.length - 1];
        if (newStop) {
          this.flyToStop(newStop.id);
        }
        this.closeAddMenu();
      },

      /**
       * Enters edit mode for a specific stop.
       * @param {Stop} stop - The stop to edit.
       */
      startEdit(stop) {
        this.store.editingStopId = stop.id;
        this.store.editForm = { ...stop, query: stop.searchQuery || stop.title };
      },

      /**
       * Populates the edit form with data from a selected suggestion.
       * @param {Object} item - The selected suggestion item.
       */
      selectEditSuggestion(item) {
        this.editForm.query = item.display_name;
        this.editForm.searchQuery = item.display_name;
        this.editForm.latitude = Number.parseFloat(item.lat);
        this.editForm.longitude = Number.parseFloat(item.lon);
      },

      /** Saves the current edit form data back to the itinerary. */
      saveEdit() {
        const idx = this.stops.findIndex(s => s.id === this.editingStopId);
        if (idx === -1) return;
        this.store.updateStop(idx, this.editForm);
        this.store.editingStopId = null;
        this.flyToStop(this.stops[idx].id, false);
      },

      /** Cancels edit mode without saving changes. */
      cancelEdit() {
        this.store.editingStopId = null;
      },

      /**
       * Deletes a stop from the itinerary.
       * @param {string|number} stopId - ID of the stop to delete.
       */
      deleteStop(stopId) {
        if (!confirm("Remove this stop?")) return;
        const index = this.stops.findIndex(s => s.id === stopId);
        if (index === -1) return;

        this.store.deleteStop(index);
        if (this.activeIndex >= 0 && this.stops[this.activeIndex]) {
          this.flyToStop(this.stops[this.activeIndex].id, false);
        }
      },

      /** Returns all stops associated with a specific day. */
      getStopsForDay(dayId) {
        return this.stops.filter(s => s.dayId === dayId);
      },

      /**
       * Returns the relative index of a stop within its day IF it is
       * currently active globally. Otherwise returns -1.
       */
      activeStopIndexInDay(stopId, dayId) {
        const activeStop = this.stops[this.activeIndex];
        if (activeStop && activeStop.id === stopId) {
          const dayStops = this.getStopsForDay(dayId);
          return dayStops.findIndex(s => s.id === stopId);
        }
        return -1;
      },

      /** Initializes Sortable.js for each day's stop list. */
      initSortable() {
        // Use nextTick to ensure the DOM for all days is rendered
        nextTick(() => {
          const containers = document.querySelectorAll(".day-stops-list");
          containers.forEach(container => {
            // Avoid re-initializing
            if (container.sortable) container.sortable.destroy();

            container.sortable = window.Sortable.create(container, {
              group: "stops",
              animation: 170,
              delay: 100,
              delayOnTouchOnly: false,
              filter: "button, input, textarea, .rc-exclude-drag",
              preventOnFilter: false,
              onEnd: (e) => {
                const stopId = e.item.id.replace("card-", "");
                const targetDayId = e.to.dataset.dayId;
                const newIdxInDay = e.newIndex;

                // Find where the stop should be in the global flat list
                const globalIdx = this.stops.findIndex(s => s.id == stopId);
                if (globalIdx === -1) return;

                // 1. Find the target day's stops
                const targetDayStops = this.getStopsForDay(targetDayId);

                // 2. Find the global index where it should be inserted
                let targetGlobalIdx;
                if (targetDayStops.length === 0 || (targetDayStops.length === 1 && targetDayStops[0].id === stopId)) {
                  // If it's the only stop in the day, move it to after the day before it (conceptually)
                  // In our flat list model, we need to find the correct spot.
                  // A simpler way is to just filter, move, and update.
                  targetGlobalIdx = this.stops.length; // Placeholder
                }

                // Because we use a flat list, moving across groups is tricky for Sortable.
                // We'll perform a "Move to Day at Position" operation.
                const movedStop = this.stops[globalIdx];
                const otherStops = this.stops.filter(s => s.id !== stopId);

                // Find all stops for target day (excluding the moved one)
                const dayStops = otherStops.filter(s => s.dayId === targetDayId);

                let insertAt;
                if (newIdxInDay >= dayStops.length) {
                  // Add to the end of the day's stops
                  const lastInDay = dayStops[dayStops.length - 1];
                  insertAt = lastInDay ? otherStops.indexOf(lastInDay) + 1 : otherStops.length;
                } else {
                  // Insert before a specific stop
                  const beforeStop = dayStops[newIdxInDay];
                  insertAt = otherStops.indexOf(beforeStop);
                }

                // Apply updates to the store
                movedStop.dayId = targetDayId;
                otherStops.splice(insertAt, 0, movedStop);
                this.store.stops = otherStops;

                this.flyToStop(stopId);

                // Re-init to ensure DOM and data are in sync
                this.initSortable();
              }
            });
          });
        });
      }
    },

    watch: {
      stops: {
        async handler() {
          await this.updateRouteGeometries();
          this.syncMapData();
        },
        deep: true
      },
      "store.days": { handler() { this.initSortable(); }, deep: true },
      activeIndex() { this.syncMapData(); },
      activeDayId(newDayId) {
        const dayStops = this.getStopsForDay(newDayId);
        if (this.mapLoaded && dayStops.length > 0) {
          RC.fitToDayStops(this.map, dayStops);
        }
      }
    },

    mounted() {
      const urlPayload = RC.getHashData();
      const localPayload = RC.getFromLocalStorage();

      const urlValid = RC.ItineraryService.sanitizeStops(urlPayload?.stops).length > 0;
      const localValid = RC.ItineraryService.sanitizeStops(localPayload?.stops).length > 0;

      if (urlValid) {
        // Priority 1: Load from URL
        if (this.store.loadPayload(urlPayload)) {
          this.flyToStop(this.activeIndex, false);
        }
        // If local data also exists, offer to restore it via toast
        if (localValid) {
          this.pendingLocalData = localPayload;
          this.showLocalDataToast = true;
        }
      } else if (localValid) {
        // Priority 2: Load from LocalStorage if no URL data
        if (this.store.loadPayload(localPayload)) {
          this.flyToStop(this.activeIndex, false);
        }
      } else {
        // First load or empty state: initialize with migrated initial stops
        this.store.loadPayload({ stops: RC.initialStops });
      }

      this.initMap();
      this.initSortable();

      // Global click listener to close menus when clicking outside
      document.addEventListener("pointerdown", (e) => {
        if (!e.target.closest(".add-stop-menu")) this.addMenuOpen = false;
      }, true);
    }
  }).mount("#app");
})();
