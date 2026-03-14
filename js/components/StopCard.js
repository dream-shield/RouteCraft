(function stopCardComponent() {
  const RC = window.RouteCraft;

  window.StopCard = {
    template: '#stop-card-template',
    props: {
      stop: Object,
      index: Number,
      activeIndex: Number,
      editingStopId: [Number, String],
      editForm: Object,
      editSuggestions: Array,
      editHighlighted: Number,
      showEditSuggestions: Boolean,
      routeColors: Array
    },
    emits: [
      'fly-to-stop',
      'set-segment-mode',
      'start-edit',
      'delete-stop',
      'save-edit',
      'cancel-edit',
      'edit-query-input',
      'move-edit-selection',
      'select-highlighted-edit',
      'select-edit-suggestion'
    ],
    methods: {
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
      }
    }
  };
})();
