/**
 * @fileoverview Vue component for the Day Header in the multi-day itinerary.
 */

(function dayHeaderComponent() {
  const RC = window.RouteCraft;

  window.DayHeader = {
    template: '#day-header-template',
    props: {
      /** @type {Day} */
      day: Object,
      /** @type {boolean} */
      isActive: Boolean
    },
    emits: [
      'toggle-collapse',
      'select-day',
      'update-day',
      'delete-day',
      'toggle-add-menu'
    ],
    methods: {
      /**
       * Combined action for clicking the Day Header.
       * Selects the day on the map.
       */
      toggleAndSelect() {
        this.$emit('select-day');
      },
      /**
       * Triggers the hidden date picker by clicking the hidden input.
       */
      triggerDatePicker() {
        this.$refs.dateInput.showPicker();
      },
      /**
       * Formats the day's date for display.
       * @param {string} dateStr - ISO date string.
       * @returns {string}
       */
      formatDate(dateStr) {
        return RC.ItineraryService.formatDate(dateStr);
      }
    }
  };
})();
