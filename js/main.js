(function bootstrap() {
  const { createApp, nextTick } = Vue;
  const RouteCraft = window.RouteCraft;
  const mapManager = RouteCraft.createMapManager(maplibregl);

  createApp({
    data() {
      return {
        stops: structuredClone(RouteCraft.initialStops),
        nextId: RouteCraft.initialStops.length + 1,
        activeIndex: 0,
        map: null,
        mapLoaded: false,
        markers: [],

        addForm: RouteCraft.createEmptyForm(),
        addSuggestions: [],
        addHighlighted: -1,
        showAddSuggestions: false,
        addMenuOpen: false,

        editingStopId: null,
        editForm: RouteCraft.createEmptyForm(),
        editSuggestions: [],
        editHighlighted: -1,
        showEditSuggestions: false
      };
    },

    computed: {
      canAddStop() {
        return (
          this.addForm.title.trim() &&
          Number.isFinite(this.addForm.zoomLevel) &&
          Number.isFinite(this.addForm.latitude) &&
          Number.isFinite(this.addForm.longitude)
        );
      }
    },

    methods: {
      initMap() {
        const firstStop = this.stops[0] || { longitude: -98.58, latitude: 39.82, zoomLevel: 3.8 };
        this.map = mapManager.create("map", firstStop);

        this.map.on("load", () => {
          this.mapLoaded = true;
          this.syncMapData();
          if (this.stops.length) {
            this.flyToStop(this.activeIndex, false);
          }
        });
      },

      syncMapData() {
        if (!this.mapLoaded) return;
        this.markers = mapManager.renderMarkers(this.map, this.stops, this.markers);
        mapManager.refreshRouteLayer(this.map, this.stops);
      },

      flyToStop(index, shouldScroll = true) {
        if (index < 0 || index >= this.stops.length) return;

        const stop = this.stops[index];
        this.activeIndex = index;

        if (this.mapLoaded) {
          mapManager.flyToStop(this.map, stop);
        }

        if (shouldScroll) {
          nextTick(() => {
            const card = document.getElementById(`card-${stop.id}`);
            if (card) {
              card.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          });
        }
      },

      goPrev() {
        if (this.activeIndex > 0) {
          this.flyToStop(this.activeIndex - 1);
        }
      },

      goNext() {
        if (this.activeIndex < this.stops.length - 1) {
          this.flyToStop(this.activeIndex + 1);
        }
      },

      async runAddSearch() {
        this.addSuggestions = await RouteCraft.fetchSuggestions(this.addForm.query);
        this.addHighlighted = this.addSuggestions.length ? 0 : -1;
        this.showAddSuggestions = true;
      },

      async runEditSearch() {
        this.editSuggestions = await RouteCraft.fetchSuggestions(this.editForm.query);
        this.editHighlighted = this.editSuggestions.length ? 0 : -1;
        this.showEditSuggestions = true;
      },

      onAddQueryInput: RouteCraft.debounce(function onAddQueryInputDebounced() {
        this.runAddSearch();
      }, 280),

      onEditQueryInput: RouteCraft.debounce(function onEditQueryInputDebounced() {
        this.runEditSearch();
      }, 280),

      moveAddSelection(step) {
        if (!this.addSuggestions.length) return;
        const count = this.addSuggestions.length;
        this.addHighlighted = (this.addHighlighted + step + count) % count;
      },

      selectHighlightedAdd() {
        if (this.addHighlighted < 0 || this.addHighlighted >= this.addSuggestions.length) return;
        this.selectAddSuggestion(this.addSuggestions[this.addHighlighted]);
      },

      selectAddSuggestion(item) {
        this.addForm.query = item.display_name;
        this.addForm.searchQuery = item.display_name;
        this.addForm.latitude = Number.parseFloat(item.lat);
        this.addForm.longitude = Number.parseFloat(item.lon);
        if (!this.addForm.title.trim()) {
          this.addForm.title = item.display_name.split(",")[0].trim();
        }
        this.showAddSuggestions = false;
      },

      addStop() {
        if (!this.canAddStop) return;

        this.stops.push({
          id: this.nextId++,
          title: this.addForm.title.trim(),
          description: this.addForm.description.trim(),
          longitude: this.addForm.longitude,
          latitude: this.addForm.latitude,
          zoomLevel: RouteCraft.clampZoom(this.addForm.zoomLevel),
          searchQuery: this.addForm.searchQuery || this.addForm.query
        });

        this.syncMapData();
        this.flyToStop(this.stops.length - 1);

        this.addForm = RouteCraft.createEmptyForm();
        this.addSuggestions = [];
        this.addHighlighted = -1;
        this.showAddSuggestions = false;
        this.addMenuOpen = false;
      },

      toggleAddMenu() {
        this.addMenuOpen = !this.addMenuOpen;
        if (!this.addMenuOpen) {
          this.showAddSuggestions = false;
        }
      },

      startEdit(stop) {
        this.editingStopId = stop.id;
        this.editForm = {
          query: stop.searchQuery || stop.title,
          title: stop.title,
          description: stop.description,
          zoomLevel: stop.zoomLevel,
          latitude: stop.latitude,
          longitude: stop.longitude,
          searchQuery: stop.searchQuery || stop.title
        };
        this.editSuggestions = [];
        this.editHighlighted = -1;
        this.showEditSuggestions = false;
      },

      moveEditSelection(step) {
        if (!this.editSuggestions.length) return;
        const count = this.editSuggestions.length;
        this.editHighlighted = (this.editHighlighted + step + count) % count;
      },

      selectHighlightedEdit() {
        if (this.editHighlighted < 0 || this.editHighlighted >= this.editSuggestions.length) return;
        this.selectEditSuggestion(this.editSuggestions[this.editHighlighted]);
      },

      selectEditSuggestion(item) {
        this.editForm.query = item.display_name;
        this.editForm.searchQuery = item.display_name;
        this.editForm.latitude = Number.parseFloat(item.lat);
        this.editForm.longitude = Number.parseFloat(item.lon);
        this.showEditSuggestions = false;
      },

      saveEdit() {
        if (!this.editingStopId) return;

        const index = this.stops.findIndex((stop) => stop.id === this.editingStopId);
        if (index === -1) return;

        const current = this.stops[index];
        this.stops[index] = {
          ...current,
          title: this.editForm.title.trim() || current.title,
          description: this.editForm.description.trim(),
          zoomLevel: RouteCraft.clampZoom(this.editForm.zoomLevel || current.zoomLevel),
          latitude: Number.isFinite(this.editForm.latitude) ? this.editForm.latitude : current.latitude,
          longitude: Number.isFinite(this.editForm.longitude) ? this.editForm.longitude : current.longitude,
          searchQuery: this.editForm.searchQuery || current.searchQuery
        };

        this.editingStopId = null;
        this.editSuggestions = [];
        this.showEditSuggestions = false;

        this.syncMapData();
        this.flyToStop(index, false);
      },

      cancelEdit() {
        this.editingStopId = null;
        this.editSuggestions = [];
        this.showEditSuggestions = false;
      },

      handleGlobalPointerDown(event) {
        const target = event.target;
        if (!target.closest(".add-stop-menu")) {
          this.addMenuOpen = false;
        }
        if (!target.closest(".autocomplete-add")) {
          this.showAddSuggestions = false;
        }
        if (!target.closest(".autocomplete-edit")) {
          this.showEditSuggestions = false;
        }
      },

      handleGlobalKeyDown(event) {
        if (event.key === "Escape") {
          this.addMenuOpen = false;
          this.showAddSuggestions = false;
          this.showEditSuggestions = false;
        }
      },

      deleteStop(index) {
        if (index < 0 || index >= this.stops.length) return;
        if (!confirm("Remove this stop from the itinerary?")) return;

        this.stops.splice(index, 1);
        if (!this.stops.length) {
          this.activeIndex = -1;
        } else if (this.activeIndex >= this.stops.length) {
          this.activeIndex = this.stops.length - 1;
        }

        this.syncMapData();
        if (this.activeIndex >= 0) {
          this.flyToStop(this.activeIndex, false);
        }
      },

      initSortable() {
        if (!this.$refs.cardsList) return;

        Sortable.create(this.$refs.cardsList, {
          animation: 170,
          handle: ".drag-handle",
          draggable: "article",
          onEnd: (event) => {
            const oldIndex = event.oldIndex;
            const newIndex = event.newIndex;
            if (oldIndex === newIndex) return;

            const movedStop = this.stops.splice(oldIndex, 1)[0];
            this.stops.splice(newIndex, 0, movedStop);

            if (this.activeIndex === oldIndex) {
              this.activeIndex = newIndex;
            } else if (oldIndex < this.activeIndex && newIndex >= this.activeIndex) {
              this.activeIndex -= 1;
            } else if (oldIndex > this.activeIndex && newIndex <= this.activeIndex) {
              this.activeIndex += 1;
            }

            this.syncMapData();
            if (this.activeIndex >= 0) {
              this.flyToStop(this.activeIndex, false);
            }
          }
        });
      }
    },

    mounted() {
      this.initMap();
      this.initSortable();

      this._onDocPointerDown = (event) => this.handleGlobalPointerDown(event);
      this._onDocKeyDown = (event) => this.handleGlobalKeyDown(event);
      document.addEventListener("pointerdown", this._onDocPointerDown, true);
      document.addEventListener("keydown", this._onDocKeyDown, true);
    },

    beforeUnmount() {
      if (this._onDocPointerDown) {
        document.removeEventListener("pointerdown", this._onDocPointerDown, true);
      }
      if (this._onDocKeyDown) {
        document.removeEventListener("keydown", this._onDocKeyDown, true);
      }
    }
  }).mount("#app");
})();
