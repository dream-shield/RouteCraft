/**
 * @fileoverview Vue component for displaying a stop card in the itinerary.
 * Supports viewing, editing, deleting, and reordering stops.
 */

(function stopCardComponent() {
  const RC = window.RouteCraft;

  window.StopCard = {
    template: '#stop-card-template',
    props: {
      /** @type {Stop} */
      stop: Object,
      /** @type {number} */
      index: Number,
      /** @type {number} */
      activeIndex: Number,
      /** @type {boolean} */
      isGloballyActive: Boolean,
      /** @type {number|string} */
      editingStopId: [Number, String],
      /** @type {Object} */
      editForm: Object,
      /** @type {string[]} */
      routeColors: Array
    },
    components: {
      'place-search': window.PlaceSearch
    },
    emits: [
      'fly-to-stop',
      'set-segment-mode',
      'start-edit',
      'delete-stop',
      'save-edit',
      'cancel-edit',
      'select-edit-suggestion'
    ],
    methods: {
      /**
       * Gets the color assigned to the route segment leading to this stop.
       * @param {number} index - The index of the stop within its day.
       * @returns {string} Hex color string.
       */
      getRouteColor(index) {
        return this.routeColors[index % this.routeColors.length];
      },
      /**
       * Generates a style object for the stop number badge.
       * @param {number} index - The index of the stop within its day.
       * @returns {Object} CSS style object.
       */
      getBadgeStyle(index) {
        const color = this.getRouteColor(index);
        return {
          backgroundColor: `${color}1A`, // 10% opacity
          color,
          border: `1px solid ${color}55` // 33% opacity
        };
      }
    }
  };
})();
