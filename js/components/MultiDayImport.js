/**
 * @fileoverview Vue component for the "Multi-Day Import" menu.
 * Specializes in bulk text import across multiple days with replace support.
 */

(function multiDayImportComponent() {
  const RC = window.RouteCraft;

  window.MultiDayImport = {
    template: '#multi-day-import-template',
    props: {
      /** @type {boolean} */
      open: Boolean
    },
    emits: ['bulk-add', 'close'],
    data() {
      return {
        /** @type {string} Raw text for bulk import */
        bulkText: '',
        /** @type {Object[]} List of detected and geocoded places */
        detectedPlaces: [],
        /** @type {boolean} Whether geocoding is in progress */
        isGeocoding: false,
        /** @type {boolean} Whether to replace existing days */
        replaceExisting: false
      };
    },
    computed: {
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
       * Emits the bulk-add event with all selected detected places.
       */
      addBulkStops() {
        const selected = this.detectedPlaces.filter(p => p.selected && p.found);

        this.$emit('bulk-add', {
          items: selected,
          replaceExisting: this.replaceExisting
        });

        this.reset();
      },
      /**
       * Toggles the selection status of a detected place.
       * @param {number} index - Index of the place in detectedPlaces.
       */
      togglePlaceSelection(index) {
        this.detectedPlaces[index].selected = !this.detectedPlaces[index].selected;
      },
      /**
       * Resets the component state.
       */
      reset() {
        this.bulkText = '';
        this.detectedPlaces = [];
        this.replaceExisting = false;
      }
    },
    watch: {
      open(isOpen) {
        if (!isOpen) this.reset();
      }
    }
  };
})();
