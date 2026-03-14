/**
 * @fileoverview Service for MapLibre GL JS integration.
 * Manages map initialization, markers, routes, and transitions.
 */

window.RouteCraft = window.RouteCraft || {};

(function mapModule() {
  /**
   * Internal helper to generate a basic OSM raster style for the map.
   * @returns {Object} A MapLibre-compatible style object.
   */
  function getStyle() {
    return {
      version: 8,
      name: "OpenStreetMap Raster",
      sources: {
        "osm-raster-tiles": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
        }
      },
      layers: [{ id: "osm-raster", type: "raster", source: "osm-raster-tiles" }]
    };
  }

  /**
   * Initializes the MapLibre map instance.
   * @param {Object} maplibregl - The MapLibre GL JS library.
   * @param {string} containerId - The ID of the HTML element to host the map.
   * @param {Stop} firstStop - The initial stop to center the map on.
   * @returns {Object} The created MapLibre Map instance.
   */
  window.RouteCraft.createMap = function createMap(maplibregl, containerId, firstStop) {
    const map = new maplibregl.Map({
      container: containerId,
      style: getStyle(),
      center: [firstStop.longitude, firstStop.latitude],
      zoom: Math.min((firstStop.zoomLevel || 12) + 0.8, 18),
      maxZoom: 18,
      pitch: 0,
      bearing: 0
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 130, unit: "imperial" }), "bottom-right");
    return map;
  };

  /**
   * Clears old markers and renders new ones for all stops.
   * @param {Object} maplibregl - The MapLibre GL JS library.
   * @param {Object} map - The current map instance.
   * @param {Stop[]} stops - The itinerary stops to render as markers.
   * @param {Object[]} existingMarkers - The current array of rendered markers (to be cleared).
   * @param {number} activeIndex - The index of the currently active stop.
   * @param {string[]} routeColors - Array of hex colors for markers and segments.
   * @returns {Object[]} The new array of MapLibre Marker instances.
   */
  window.RouteCraft.renderMarkers = function renderMarkers(maplibregl, map, stops, existingMarkers, activeIndex, routeColors) {
    existingMarkers.forEach((marker) => marker.remove());
    const markers = [];

    stops.forEach((stop, index) => {
      const markerEl = document.createElement("div");
      markerEl.className = "custom-marker";

      const color = routeColors[index % routeColors.length];

      // High-Contrast Solid Styling
      markerEl.style.backgroundColor = color;
      markerEl.style.color = "#ffffff";
      markerEl.style.borderColor = "#ffffff";
      markerEl.style.borderStyle = 'solid';
      markerEl.style.borderWidth = '2px';

      // Inject the number
      markerEl.innerText = index + 1;

      if (index === activeIndex) {
        markerEl.classList.add("is-active");
      } else {
        markerEl.classList.add("is-dim");
      }

      const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(`<strong>${stop.title}</strong>`))
        .addTo(map);

      markers.push(marker);
    });

    return markers;
  };

  /**
   * Updates the GeoJSON source and layer that displays the itinerary route.
   * @param {Object} map - The map instance.
   * @param {Stop[]} stops - The itinerary stops.
   * @param {string[]} routeColors - Array of colors for route segments.
   * @param {number[][][]} [routeGeometries] - Custom geometries for the route segments.
   */
  window.RouteCraft.refreshRouteLayer = function refreshRouteLayer(map, stops, routeColors, routeGeometries = []) {
    const features = [];

    for (let i = 0; i < stops.length - 1; i += 1) {
      const color = routeColors[i % routeColors.length];
      const coords = routeGeometries[i] || [
        [stops[i].longitude, stops[i].latitude],
        [stops[i + 1].longitude, stops[i + 1].latitude]
      ];

      features.push({
        type: "Feature",
        properties: { color: color },
        geometry: { type: "LineString", coordinates: coords }
      });
    }

    const data = { type: "FeatureCollection", features };

    if (!map.getSource("trip-route")) {
      map.addSource("trip-route", { type: "geojson", data });
    } else {
      map.getSource("trip-route").setData(data);
    }

    if (!map.getLayer("trip-route-line")) {
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 7
        }
      });
    }
  };

  /**
   * Smoothly pans and zooms the map to focus on a specific stop.
   * @param {Object} map - The map instance.
   * @param {Stop} stop - The target stop to fly to.
   */
  window.RouteCraft.flyToStop = function flyToStop(map, stop) {
    map.flyTo({
      center: [stop.longitude, stop.latitude],
      zoom: Math.min((stop.zoomLevel || 12) + 0.8, 18),
      duration: 1600,
      essential: true,
      pitch: 0,
      bearing: 0
    });
  };
})();
