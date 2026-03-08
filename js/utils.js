window.RouteCraft = window.RouteCraft || {};

window.RouteCraft.clampZoom = function clampZoom(value) {
  return Math.max(2, Math.min(18, Number(value) || 12));
};

window.RouteCraft.debounce = function debounce(fn, delay) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};
