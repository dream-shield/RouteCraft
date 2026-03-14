/**
 * @fileoverview Vue component for the "Add Place" dropdown menu.
 * Uses the PlaceSearch component to handle location searching and ImportService for batch import.
 */

(function addStopMenuComponent() {
  const RC = window.RouteCraft;

  window.AddStopMenu = {
    template: '#add-stop-menu-template',
    props: {
      /** @type {boolean} */
      open: Boolean
    },
    components: {
      'place-search': window.PlaceSearch
    },
    emits: ['add-stop', 'close'],
    data() {
      return {
        /** @type {'single'|'bulk'} Current active tab */
        currentTab: 'single',
        /** @type {Object} New stop form data for single add */
        addForm: RC.createEmptyForm(),
        /** @type {string} Raw text for bulk import */
        bulkText: '',
        /** @type {Object[]} List of detected and geocoded places */
        detectedPlaces: [],
        /** @type {boolean} Whether geocoding is in progress */
        isGeocoding: false
      };
    },
    computed: {
      /**
       * Validates if the current form data is sufficient to add a stop.
       * @returns {boolean}
       */
      canAddStop() {
        return (
          this.addForm.title.trim() &&
          Number.isFinite(this.addForm.latitude) &&
          Number.isFinite(this.addForm.longitude)
        );
      },
      /**
       * Checks if any detected places are selected for import.
       * @returns {boolean}
       */
      hasSelectedPlaces() {
        return this.detectedPlaces.some(p => p.selected && p.found);
      }
    },
    methods: {
      /**
       * Populates the form with data from a selected geocoding result.
       * @param {Object} item - The selected suggestion item.
       */
      selectAddSuggestion(item) {
        this.addForm.query = item.display_name;
        this.addForm.searchQuery = item.display_name;
        this.addForm.latitude = Number.parseFloat(item.lat);
        this.addForm.longitude = Number.parseFloat(item.lon);
        if (!this.addForm.title.trim()) {
          this.addForm.title = item.display_name.split(",")[0].trim();
        }
      },
      /**
       * Finalizes and emits the "add-stop" event with the current form data.
       */
      addStop() {
        if (!this.canAddStop) return;
        this.$emit('add-stop', { ...this.addForm });
        this.addForm = RC.createEmptyForm();
      },
      /**
       * Runs the bulk geocoding process using the ImportService.
       */
      async runBulkGeocode() {
        if (!this.bulkText.trim() || this.isGeocoding) return;
        
        this.isGeocoding = true;
        try {
          const results = await RC.ImportService.process(this.bulkText);
          this.detectedPlaces = results.map(r => ({
            ...r,
            selected: r.found // Default to selected if found
          }));
        } finally {
          this.isGeocoding = false;
        }
      },
      /**
       * Adds all selected detected places to the itinerary.
       */
      addBulkStops() {
        const selected = this.detectedPlaces.filter(p => p.selected && p.found);
        selected.forEach(place => {
          const newStop = RC.createEmptyForm();
          newStop.title = place.title;
          newStop.latitude = Number.parseFloat(place.lat);
          newStop.longitude = Number.parseFloat(place.lon);
          newStop.searchQuery = place.displayName;
          this.$emit('add-stop', newStop);
        });
        
        // Reset bulk import state
        this.bulkText = '';
        this.detectedPlaces = [];
        this.currentTab = 'single';
      },
      /**
       * Toggles the selection status of a detected place.
       * @param {number} index - Index of the place in detectedPlaces.
       */
      togglePlaceSelection(index) {
        this.detectedPlaces[index].selected = !this.detectedPlaces[index].selected;
      }
    },
    watch: {
      /**
       * Reset state when the menu is closed.
       */
      open(isOpen) {
        if (!isOpen) {
          this.currentTab = 'single';
          this.bulkText = '';
          this.detectedPlaces = [];
          this.addForm = RC.createEmptyForm();
        }
      }
    }
  };
})();
