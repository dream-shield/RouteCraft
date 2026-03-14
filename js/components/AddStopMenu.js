/**
 * @fileoverview Vue component for the "Add Destination" dropdown menu.
 * Uses the PlaceSearch component to handle location searching.
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
        /** @type {Object} New stop form data */
        addForm: RC.createEmptyForm()
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
      }
    }
  };
})();
