/**
 * @fileoverview Vue component for the "Local Data" toast notification.
 * Shown when the app prioritizes URL data but finds existing LocalStorage data.
 */

(function localDataToastComponent() {
  window.LocalDataToast = {
    template: '#local-data-toast-template',
    props: {
      /** @type {boolean} Controls toast visibility */
      show: Boolean
    },
    emits: [
      /** Triggered when the user chooses to restore local data */
      'restore',
      /** Triggered when the user dismisses the notification */
      'dismiss'
    ]
  };
})();
