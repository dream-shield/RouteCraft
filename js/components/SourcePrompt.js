(function sourcePromptComponent() {
  window.SourcePrompt = {
    template: '#source-prompt-template',
    props: {
      show: Boolean
    },
    emits: ['choose-url', 'choose-local']
  };
})();
