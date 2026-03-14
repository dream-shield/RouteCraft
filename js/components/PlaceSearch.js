/**
 * @fileoverview Reusable Vue component for place search and autocomplete.
 * Handles query input, debounced fetching of suggestions, and keyboard navigation.
 */

(function placeSearchComponent() {
  const RC = window.RouteCraft;

  window.PlaceSearch = {
    template: '#place-search-template',
    props: {
      /** @type {string} Initial query value */
      value: {
        type: String,
        default: ""
      },
      /** @type {string} Placeholder text for the input */
      placeholder: {
        type: String,
        default: "Search place or address"
      },
      /** @type {string} Additional CSS classes for the container */
      containerClass: {
        type: String,
        default: ""
      }
    },
    emits: ['select', 'input'],
    data() {
      return {
        query: this.value,
        suggestions: [],
        highlightedIndex: -1,
        showSuggestions: false
      };
    },
    methods: {
      /**
       * Performs a geocoding search using the current query.
       */
      async runSearch() {
        if (!this.query.trim()) {
          this.suggestions = [];
          this.showSuggestions = false;
          return;
        }
        this.suggestions = await RC.fetchSuggestions(this.query);
        this.highlightedIndex = this.suggestions.length ? 0 : -1;
        this.showSuggestions = true;
      },
      /**
       * Debounced search handler.
       */
      onInput: RC.debounce(function() {
        this.$emit('input', this.query);
        this.runSearch();
      }, 280),
      /**
       * Navigates suggestions using arrow keys.
       * @param {number} step - Direction of movement.
       */
      moveSelection(step) {
        if (!this.suggestions.length) return;
        const count = this.suggestions.length;
        this.highlightedIndex = (this.highlightedIndex + step + count) % count;
      },
      /**
       * Selects the currently highlighted suggestion.
       */
      selectHighlighted() {
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.suggestions.length) {
          this.selectSuggestion(this.suggestions[this.highlightedIndex]);
        }
      },
      /**
       * Emits the selected suggestion and resets the component state.
       * @param {Object} item - The selected geocoding result.
       */
      selectSuggestion(item) {
        this.query = item.display_name;
        this.showSuggestions = false;
        this.$emit('select', item);
      },
      /**
       * Resets the suggestions list and visibility.
       */
      close() {
        this.showSuggestions = false;
        this.highlightedIndex = -1;
      }
    },
    watch: {
      value(newVal) {
        this.query = newVal;
      }
    }
  };
})();
