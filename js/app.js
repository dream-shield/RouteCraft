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
      'stop-card': window.StopCard,
      'add-stop-menu': window.AddStopMenu,
      'source-prompt': window.SourcePrompt
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

        /** @type {boolean} State of the Add Destination menu */
        addMenuOpen: false,

        /** @type {number|null} ID of the stop currently being edited */
        editingStopId: null,
        /** @type {Object} State of the edit form */
        editForm: RC.createEmptyForm(),

        /** @type {boolean} Visibility of the data source prompt modal */
        sourcePromptOpen: false,
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
      activeIndex() { return this.store.activeIndex; }
    },

    methods: {
      /** Handles the decision to use data loaded from the URL. */
      chooseUrlData() {
        if (this.pendingUrlData) {
          this.store.loadPayload(this.pendingUrlData);
        }
        this.sourcePromptOpen = false;
      },

      /** Handles the decision to use data loaded from LocalStorage. */
      chooseLocalData() {
        if (this.pendingLocalData) {
          this.store.loadPayload(this.pendingLocalData);
        }
        this.sourcePromptOpen = false;
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
          this.syncMapData();
          this.flyToStop(0, false);
        } catch (e) { alert("Failed to import KML."); }
        event.target.value = "";
      },

      /** Initializes the MapLibre map instance. */
      initMap() {
        const firstStop = this.stops[0] || { longitude: -98.58, latitude: 39.82, zoomLevel: 3.8 };
        this.map = RC.createMap(window.maplibregl, "map", firstStop);
        this.map.on("load", () => {
          this.mapLoaded = true;
          this.syncMapData();
          if (this.stops.length) this.flyToStop(this.activeIndex, false);
        });
      },

      /** Synchronizes the current stop data with the map's markers and route lines. */
      syncMapData() {
        if (!this.mapLoaded) return;
        this.markers = RC.renderMarkers(window.maplibregl, this.map, this.stops, this.markers, this.activeIndex, this.routeColors);
        RC.refreshRouteLayer(this.map, this.stops, this.routeColors, this.routeGeometries);
      },

      /** Fetches updated route geometries for all segments in the itinerary. */
      async updateRouteGeometries() {
        const geometries = [];
        for (let i = 0; i < this.stops.length - 1; i++) {
          geometries.push(await RC.fetchRouteSegment(this.stops[i], this.stops[i + 1], this.stops[i + 1].transportMode || "auto", this.stadiaApiKey));
        }
        this.routeGeometries = geometries;
        this.syncMapData();
      },

      /**
       * Sets the transport mode for a specific segment and fetches new geometry.
       * @param {number} index - Index of the destination stop for the segment.
       * @param {TransportMode} mode - The new transport mode.
       */
      async setSegmentMode(index, mode) {
        this.store.updateStop(index, { transportMode: mode });
        const start = this.stops[index - 1];
        const end = this.stops[index];
        const coords = await RC.fetchRouteSegment(start, end, mode, this.stadiaApiKey);
        this.routeGeometries[index - 1] = coords;
        this.syncMapData();
      },

      /**
       * Focuses the map on a specific stop and highlights it in the UI.
       * @param {number} index - The index of the stop to focus.
       * @param {boolean} [shouldScroll=true] - Whether to scroll the sidebar card into view.
       */
      flyToStop(index, shouldScroll = true) {
        if (index < 0 || index >= this.stops.length) return;
        this.store.activeIndex = index;
        if (this.mapLoaded) {
          RC.flyToStop(this.map, this.stops[index]);
          this.syncMapData();
        }
        if (shouldScroll) {
          nextTick(() => {
            document.getElementById(`card-${this.stops[index].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      },

      /** Navigates to the previous stop in the itinerary. */
      goPrev() { if (this.activeIndex > 0) this.flyToStop(this.activeIndex - 1); },
      /** Navigates to the next stop in the itinerary. */
      goNext() { if (this.activeIndex < this.stops.length - 1) this.flyToStop(this.activeIndex + 1); },

      /** Toggles the visibility of the Add Destination menu. */
      toggleAddMenu() {
        this.addMenuOpen = !this.addMenuOpen;
      },

      /**
       * Callback for when the AddStopMenu component emits a new stop.
       * @param {Object} formData - Data for the new stop.
       */
      onComponentAddStop(formData) {
        this.store.addStop(formData);
        this.syncMapData();
        this.flyToStop(this.stops.length - 1);
        this.addMenuOpen = false;
      },

      /**
       * Enters edit mode for a specific stop.
       * @param {Stop} stop - The stop to edit.
       */
      startEdit(stop) {
        this.editingStopId = stop.id;
        this.editForm = { ...stop, query: stop.searchQuery || stop.title };
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
        this.editingStopId = null;
        this.syncMapData();
        this.flyToStop(idx, false);
      },

      /** Cancels edit mode without saving changes. */
      cancelEdit() {
        this.editingStopId = null;
      },

      /**
       * Deletes a stop from the itinerary.
       * @param {number} index - Index of the stop to delete.
       */
      deleteStop(index) {
        if (!confirm("Remove this stop?")) return;
        this.store.deleteStop(index);
        this.syncMapData();
        if (this.activeIndex >= 0) this.flyToStop(this.activeIndex, false);
      },

      /** Initializes Sortable.js for drag-and-drop reordering of stop cards. */
      initSortable() {
        if (!this.$refs.cardsList) return;
        window.Sortable.create(this.$refs.cardsList, {
          handle: ".drag-handle", animation: 170,
          onEnd: (e) => {
            const oldIdx = e.oldIndex;
            const newIdx = e.newIndex;
            if (oldIdx === newIdx) return;

            this.store.reorderStops(oldIdx, newIdx);
            this.syncMapData();
            if (this.activeIndex >= 0) this.flyToStop(this.activeIndex, false);
          }
        });
      }
    },

    watch: {
      stops: { handler() { this.updateRouteGeometries(); }, deep: true },
      activeIndex() { this.syncMapData(); }
    },

    mounted() {
      const urlPayload = RC.getHashData();
      const localPayload = RC.getFromLocalStorage();

      const urlValid = RC.ItineraryService.sanitizeStops(urlPayload?.stops).length > 0;
      const localValid = RC.ItineraryService.sanitizeStops(localPayload?.stops).length > 0;

      if (urlValid && localValid) {
        this.pendingUrlData = urlPayload;
        this.pendingLocalData = localPayload;
        this.sourcePromptOpen = true;
      } else if (urlValid) {
        this.store.loadPayload(urlPayload);
      } else if (localValid) {
        this.store.loadPayload(localPayload);
      }

      this.initMap();
      this.initSortable();
      this.updateRouteGeometries();

      // Global click listener to close menus when clicking outside
      document.addEventListener("pointerdown", (e) => {
        if (!e.target.closest(".add-stop-menu")) this.addMenuOpen = false;
      }, true);
    }
  }).mount("#app");
})();
