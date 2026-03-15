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
      zoom: 12.8,
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
   * @param {Stop[]} allStops - All itinerary stops.
   * @param {Object[]} existingMarkers - The current array of rendered markers (to be cleared).
   * @param {string|number|null} activeStopId - The ID of the currently active stop.
   * @param {string|null} activeDayId - The ID of the currently active day.
   * @param {string[]} routeColors - Array of hex colors for markers and segments.
   * @returns {Object[]} The new array of MapLibre Marker instances.
   */
  window.RouteCraft.renderMarkers = function renderMarkers(maplibregl, map, allStops, existingMarkers, activeStopId, activeDayId, routeColors) {
    existingMarkers.forEach((marker) => marker.remove());
    const markers = [];

    // Track indexing per day for marker labels
    const dayIndices = {};

    allStops.forEach((stop) => {
      // Calculate label (index within its own day)
      const dId = stop.dayId || 'no-day';
      dayIndices[dId] = (dayIndices[dId] || 0) + 1;
      const label = dayIndices[dId];

      const markerEl = document.createElement("div");
      markerEl.className = "custom-marker";

      const color = routeColors[(label - 1) % routeColors.length];

      // High-Contrast Solid Styling
      markerEl.style.backgroundColor = color;
      markerEl.style.color = "#ffffff";
      markerEl.style.borderColor = "#ffffff";
      markerEl.style.borderStyle = 'solid';
      markerEl.style.borderWidth = '2px';

      markerEl.innerText = label;

      // Highlight logic
      if (stop.id === activeStopId) {
        markerEl.classList.add("is-active");
      }

      const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(`<strong>${stop.title}</strong>`))
        .addTo(map);

      if (stop.id === activeStopId) {
        marker.togglePopup();
      }

      markers.push(marker);
    });

    return markers;
  };

  /**
   * Updates the GeoJSON source and layer that displays the itinerary route.
   * @param {Object} map - The map instance.
   * @param {Stop[]} allStops - All itinerary stops.
   * @param {string|null} activeDayId - The ID of the currently active day.
   * @param {string[]} routeColors - Array of colors for route segments.
   * @param {number[][][]} routeGeometries - Custom geometries for the route segments.
   */
  window.RouteCraft.refreshRouteLayer = function refreshRouteLayer(map, allStops, activeDayId, routeColors, routeGeometries = []) {
    const features = [];
    const dayCounter = {};

    for (let i = 0; i < allStops.length - 1; i += 1) {
      const origin = allStops[i];
      const destination = allStops[i + 1];

      // Increment counter for numbering consistency
      const dId = origin.dayId || 'no-day';
      dayCounter[dId] = (dayCounter[dId] || 0) + 1;
      const labelIdx = dayCounter[dId] - 1;

      // Only draw routes within the same day
      if (origin.dayId !== destination.dayId) continue;

      const color = routeColors[labelIdx % routeColors.length];

      const fallbackCoords = [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ];

      // Geometries are indexed by the original global stop index
      const coords = routeGeometries[i] || fallbackCoords;

      features.push({
        type: "Feature",
        properties: { 
          color: color
        },
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
      zoom: 12.8,
      duration: 1600,
      essential: true,
      pitch: 0,
      bearing: 0
    });
  };

  /**
   * Adjusts the map view to fit all stops of a specific day.
   * @param {Object} map - The map instance.
   * @param {Stop[]} dayStops - Array of stops for the day.
   */
  window.RouteCraft.fitToDayStops = function fitToDayStops(map, dayStops) {
    if (!dayStops || dayStops.length === 0) return;

    const bounds = new window.maplibregl.LngLatBounds();
    dayStops.forEach(stop => bounds.extend([stop.longitude, stop.latitude]));

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 80, right: 80 },
      maxZoom: 14,
      duration: 1200
    });
  };
})();
