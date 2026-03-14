(function bootstrap() {
  const { createApp, nextTick } = Vue;
  const RouteCraft = window.RouteCraft;
  const mapManager = RouteCraft.createMapManager(maplibregl);
  const STORAGE_KEY = "routecraft_itinerary_v1";
  const HASH_KEY = "data";

  createApp({
    data() {
      return {
        stops: structuredClone(RouteCraft.initialStops),
        nextId: RouteCraft.initialStops.length + 1,
        activeIndex: 0,
        map: null,
        mapLoaded: false,
        markers: [],
        routeColors: [
          "#2563EB",
          "#06B6D4",
          "#F97316",
          "#8B5CF6",
          "#16A34A",
          "#E11D48",
          "#F59E0B",
          "#0EA5E9",
          "#A855F7",
          "#14B8A6",
          "#EF4444",
          "#22C55E"
        ],

        addForm: RouteCraft.createEmptyForm(),
        addSuggestions: [],
        addHighlighted: -1,
        showAddSuggestions: false,
        addMenuOpen: false,

        editingStopId: null,
        editForm: RouteCraft.createEmptyForm(),
        editSuggestions: [],
        editHighlighted: -1,
        showEditSuggestions: false,

        sourcePromptOpen: false,
        pendingUrlData: null,
        pendingLocalData: null,
        suppressHashUpdate: false,
        lastHashPayload: "",

        stadiaApiKey: "613372b7-785f-4b4e-9df1-0ca400312a1a",
        routeGeometries: []
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
      sanitizeStops(rawStops) {
        if (!Array.isArray(rawStops)) return [];
        return rawStops
          .map((stop) => ({
            id: Number.isFinite(Number(stop.id)) ? Number(stop.id) : null,
            title: String(stop.title || "").trim(),
            description: String(stop.description || "").trim(),
            longitude: Number(stop.longitude),
            latitude: Number(stop.latitude),
            zoomLevel: RouteCraft.clampZoom(stop.zoomLevel),
            searchQuery: String(stop.searchQuery || stop.title || "").trim(),
            transportMode: stop.transportMode || (stop.id === 1 ? null : "auto")
          }))
          .filter((stop) => stop.title && Number.isFinite(stop.longitude) && Number.isFinite(stop.latitude));
      },

      updateStopIdsAndNextId() {
        this.stops = this.stops.map((stop, idx) => ({
          ...stop,
          id: idx + 1,
          transportMode: idx === 0 ? null : (stop.transportMode || "auto")
        }));
        this.nextId = this.stops.length + 1;
      },

      saveToLocalStorage() {
        const payload = {
          stops: this.stops,
          activeIndex: this.activeIndex
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      },

      buildPayload() {
        return {
          stops: this.stops,
          activeIndex: this.activeIndex
        };
      },

      encodePayload(payload) {
        return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      },

      decodePayload(encoded) {
        try {
          const json = LZString.decompressFromEncodedURIComponent(encoded);
          if (!json) return null;
          return JSON.parse(json);
        } catch (error) {
          return null;
        }
      },

      getHashData() {
        const hash = window.location.hash.replace(/^#/, "");
        if (!hash) return null;
        const params = new URLSearchParams(hash);
        const encoded = params.get(HASH_KEY);
        if (!encoded) return null;
        return this.decodePayload(encoded);
      },

      setHashFromState() {
        if (this.suppressHashUpdate) return;
        const payload = this.buildPayload();
        const encoded = this.encodePayload(payload);
        if (encoded === this.lastHashPayload) return;
        this.lastHashPayload = encoded;
        const params = new URLSearchParams();
        params.set(HASH_KEY, encoded);
        window.history.replaceState(null, "", `#${params.toString()}`);
      },

      scheduleHashUpdate() {
        if (this._hashTimer) {
          clearTimeout(this._hashTimer);
        }
        this._hashTimer = setTimeout(() => {
          this.setHashFromState();
        }, 250);
      },

      applyLoadedData(payload) {
        try {
          const sanitized = this.sanitizeStops(payload?.stops);
          if (!sanitized.length) return false;
          this.stops = sanitized;
          this.updateStopIdsAndNextId();
          this.activeIndex = Math.min(
            Math.max(Number(payload.activeIndex) || 0, 0),
            this.stops.length - 1
          );
          if (this.mapLoaded) {
            this.syncMapData();
            if (this.activeIndex >= 0) {
              this.flyToStop(this.activeIndex, false);
            }
          }
          return true;
        } catch (e) {
          console.error("Failed to apply loaded data", e);
          return false;
        }
      },

      chooseUrlData() {
        if (this.pendingUrlData) {
          this.applyLoadedData(this.pendingUrlData);
          this.saveToLocalStorage();
          this.setHashFromState();
        }
        this.pendingUrlData = null;
        this.pendingLocalData = null;
        this.sourcePromptOpen = false;
      },

      chooseLocalData() {
        if (this.pendingLocalData) {
          this.applyLoadedData(this.pendingLocalData);
          this.setHashFromState();
        }
        this.pendingUrlData = null;
        this.pendingLocalData = null;
        this.sourcePromptOpen = false;
      },

      copyShareLink() {
        this.setHashFromState();
        const url = window.location.href;
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(url);
        } else {
          window.prompt("Copy this link:", url);
        }
      },

      getRouteColor(index) {
        return this.routeColors[index % this.routeColors.length];
      },

      getBadgeStyle(index) {
        const color = this.getRouteColor(index);
        return {
          backgroundColor: `${color}1A`,
          color,
          border: `1px solid ${color}55`
        };
      },

      escapeXml(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");
      },

      exportKml() {
        if (!this.stops.length) {
          alert("No stops to export.");
          return;
        }

        const placemarks = this.stops
          .map(
            (stop) => `    <Placemark>
      <name>${this.escapeXml(stop.title)}</name>
      <description>${this.escapeXml(stop.description || "")}</description>
      <Point>
        <coordinates>${stop.longitude},${stop.latitude},0</coordinates>
      </Point>
    </Placemark>`
          )
          .join("\n");

        const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>RouteCraft Itinerary</name>
${placemarks}
  </Document>
</kml>`;

        const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "routecraft-itinerary.kml";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },

      triggerKmlImport() {
        if (this.$refs.kmlFileInput) {
          this.$refs.kmlFileInput.click();
        }
      },

      async importKmlFile(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const doc = new DOMParser().parseFromString(text, "application/xml");
          const parseError = doc.querySelector("parsererror");
          if (parseError) {
            alert("Invalid KML file.");
            return;
          }

          const placemarks = Array.from(doc.getElementsByTagName("Placemark"));
          const imported = [];

          placemarks.forEach((placemark, idx) => {
            const name = placemark.getElementsByTagName("name")[0]?.textContent?.trim() || `Stop ${idx + 1}`;
            const description = placemark.getElementsByTagName("description")[0]?.textContent?.trim() || "";
            const coordinatesText = placemark
              .getElementsByTagName("coordinates")[0]
              ?.textContent?.trim();

            if (!coordinatesText) return;
            const firstCoord = coordinatesText.split(/\s+/)[0];
            const [lonText, latText] = firstCoord.split(",");
            const longitude = Number(lonText);
            const latitude = Number(latText);
            if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

            imported.push({
              id: idx + 1,
              title: name,
              description,
              longitude,
              latitude,
              zoomLevel: 12,
              searchQuery: name
            });
          });

          if (!imported.length) {
            alert("No valid placemarks found in KML.");
            return;
          }

          this.stops = imported;
          this.updateStopIdsAndNextId();
          this.activeIndex = 0;
          this.syncMapData();
          this.flyToStop(0, false);
        } catch (error) {
          alert("Failed to import KML.");
        } finally {
          if (event?.target) {
            event.target.value = "";
          }
        }
      },

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
        this.markers = mapManager.renderMarkers(
          this.map,
          this.stops,
          this.markers,
          this.activeIndex,
          this.routeColors
        );
        mapManager.refreshRouteLayer(this.map, this.stops, this.routeColors, this.routeGeometries);
      },

      async updateRouteGeometries() {
        const geometries = [];
        for (let i = 0; i < this.stops.length - 1; i++) {
          const start = this.stops[i];
          const end = this.stops[i + 1];
          const mode = end.transportMode || "auto";
          const coords = await RouteCraft.fetchRouteSegment(start, end, mode, this.stadiaApiKey);
          geometries.push(coords);
        }
        this.routeGeometries = geometries;
        this.syncMapData();
      },

      async setSegmentMode(index, mode) {
        if (index <= 0 || index >= this.stops.length) return;
        this.stops[index].transportMode = mode;

        // Update just this segment's geometry for efficiency
        const start = this.stops[index - 1];
        const end = this.stops[index];
        const coords = await RouteCraft.fetchRouteSegment(start, end, mode, this.stadiaApiKey);

        // Replace in array (triggering reactivity if needed, though we call syncMapData)
        this.routeGeometries[index - 1] = coords;
        this.syncMapData();
        this.saveToLocalStorage();
        this.scheduleHashUpdate();
      },

      flyToStop(index, shouldScroll = true) {
        if (index < 0 || index >= this.stops.length) return;

        const stop = this.stops[index];
        this.activeIndex = index;

        if (this.mapLoaded) {
          mapManager.flyToStop(this.map, stop);
          this.markers = mapManager.renderMarkers(
            this.map,
            this.stops,
            this.markers,
            this.activeIndex,
            this.routeColors
          );
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
          ghostClass: "sortable-ghost",
          chosenClass: "sortable-chosen",
          dragClass: "sortable-drag",
          fallbackOnBody: true,
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

    watch: {
      stops: {
        handler(newStops, oldStops) {
          this.saveToLocalStorage();
          this.scheduleHashUpdate();

          if (this.mapLoaded && (!oldStops || newStops.length !== oldStops.length)) {
            this.updateRouteGeometries();
          }
        },
        deep: true
      },
      activeIndex() {
        this.saveToLocalStorage();
        this.scheduleHashUpdate();
      }
    },

    mounted() {
      let urlPayload = null;
      try {
        urlPayload = this.getHashData();
      } catch (error) {
        urlPayload = null;
      }

      let localPayload = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          localPayload = JSON.parse(raw);
        }
      } catch (error) {
        localPayload = null;
      }

      const urlValid = this.sanitizeStops(urlPayload?.stops).length > 0;
      const localValid = this.sanitizeStops(localPayload?.stops).length > 0;

      if (urlValid && localValid) {
        this.pendingUrlData = urlPayload;
        this.pendingLocalData = localPayload;
        this.sourcePromptOpen = true;
      } else if (urlValid) {
        this.applyLoadedData(urlPayload);
        this.saveToLocalStorage();
      } else if (localValid) {
        this.applyLoadedData(localPayload);
      } else if (window.location.hash) {
        alert("URL data could not be loaded. Falling back to defaults.");
      }

      this.initMap();
      this.initSortable();
      this.setHashFromState();
      this.updateRouteGeometries();

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
      if (this._hashTimer) {
        clearTimeout(this._hashTimer);
      }
    }
  }).mount("#app");
})();
