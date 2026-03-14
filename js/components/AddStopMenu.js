/**
 * @fileoverview Vue component for the "Add Destination" dropdown menu.
 * Handles location search suggestions and new stop creation.
 */

(function addStopMenuComponent() {
  const RC = window.RouteCraft;

  window.AddStopMenu = {
    template: '#add-stop-menu-template',
    props: {
      /** @type {boolean} */
      open: Boolean
    },
    emits: ['add-stop', 'close'],
    data() {
      return {
        /** @type {Object} New stop form data */
        addForm: RC.createEmptyForm(),
        /** @type {Object[]} Array of geocoding suggestions */
        addSuggestions: [],
        /** @type {number} Index of the highlighted suggestion */
        addHighlighted: -1,
        /** @type {boolean} Controls visibility of the suggestions list */
        showAddSuggestions: false
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
          Number.isFinite(this.addForm.zoomLevel) &&
          Number.isFinite(this.addForm.latitude) &&
          Number.isFinite(this.addForm.longitude)
        );
      }
    },
    methods: {
      /**
       * Performs a search against the geocoding service using the current query.
       */
      async runAddSearch() {
        this.addSuggestions = await RC.fetchSuggestions(this.addForm.query);
        this.addHighlighted = this.addSuggestions.length ? 0 : -1;
        this.showAddSuggestions = true;
      },
      /**
       * Debounced input handler for the search field.
       */
      onAddQueryInput: RC.debounce(function() {
        this.runAddSearch();
      }, 280),
      /**
       * Navigates the search suggestions using arrow keys.
       * @param {number} step - The number of positions to move (e.g., 1 or -1).
       */
      moveAddSelection(step) {
        if (!this.addSuggestions.length) return;
        const count = this.addSuggestions.length;
        this.addHighlighted = (this.addHighlighted + step + count) % count;
      },
      /**
       * Selects the currently highlighted search suggestion.
       */
      selectHighlightedAdd() {
        if (this.addHighlighted < 0 || this.addHighlighted >= this.addSuggestions.length) return;
        this.selectAddSuggestion(this.addSuggestions[this.addHighlighted]);
      },
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
        this.showAddSuggestions = false;
      },
      /**
       * Finalizes and emits the "add-stop" event with the current form data.
       */
      addStop() {
        if (!this.canAddStop) return;
        this.$emit('add-stop', { ...this.addForm });
        this.addForm = RC.createEmptyForm();
        this.addSuggestions = [];
        this.addHighlighted = -1;
        this.showAddSuggestions = false;
      }
    },
    watch: {
      open(newVal) {
        if (!newVal) {
          this.showAddSuggestions = false;
        }
      }
    }
  };
})();
