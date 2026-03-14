(function addStopMenuComponent() {
  const RC = window.RouteCraft;

  window.AddStopMenu = {
    template: '#add-stop-menu-template',
    props: {
      open: Boolean
    },
    emits: ['add-stop', 'close'],
    data() {
      return {
        addForm: RC.createEmptyForm(),
        addSuggestions: [],
        addHighlighted: -1,
        showAddSuggestions: false
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
      async runAddSearch() {
        this.addSuggestions = await RC.fetchSuggestions(this.addForm.query);
        this.addHighlighted = this.addSuggestions.length ? 0 : -1;
        this.showAddSuggestions = true;
      },
      onAddQueryInput: RC.debounce(function() {
        this.runAddSearch();
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
