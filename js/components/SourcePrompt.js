/**
 * @fileoverview Vue component for the "Source Prompt" modal.
 * Shown when both URL hash and LocalStorage contain itinerary data.
 */

(function sourcePromptComponent() {
  window.SourcePrompt = {
    template: '#source-prompt-template',
    props: {
      /** @type {boolean} Controls modal visibility */
      show: Boolean
    },
    emits: [
      /** Triggered when the user chooses to load data from the URL */
      'choose-url', 
      /** Triggered when the user chooses to load data from LocalStorage */
      'choose-local'
    ]
  };
})();
