/**
 * @fileoverview General utility functions for the RouteCraft application.
 */

window.RouteCraft = window.RouteCraft || {};

/**
 * Clamps a zoom level between the allowed minimum (2) and maximum (18).
 * @param {number|string} value - The zoom level to clamp.
 * @returns {number} The clamped zoom value.
 */
window.RouteCraft.clampZoom = function clampZoom(value) {
  return Math.max(2, Math.min(18, Number(value) || 12));
};

/**
 * Creates a debounced version of a function that delays its execution until
 * after a specified amount of time has elapsed since the last call.
 * @param {Function} fn - The function to debounce.
 * @param {number} delay - The delay in milliseconds.
 * @returns {Function} A debounced version of the input function.
 */
window.RouteCraft.debounce = function debounce(fn, delay) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};
