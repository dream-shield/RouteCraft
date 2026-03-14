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
   * @param {number} activeIndex - The index of the currently active stop in the full list.
   * @param {string[]} routeColors - Array of hex colors for markers and segments.
   * @param {string|null} activeDayId - The ID of the currently active day.
   * @returns {Object[]} The new array of MapLibre Marker instances.
   */
  window.RouteCraft.renderMarkers = function renderMarkers(maplibregl, map, stops, existingMarkers, activeIndex, routeColors, activeDayId) {
    existingMarkers.forEach((marker) => marker.remove());
    const markers = [];

    const activeStopId = stops[activeIndex]?.id;
    const dayStops = activeDayId ? stops.filter(s => s.dayId === activeDayId) : stops;

    dayStops.forEach((stop, index) => {
      const markerEl = document.createElement("div");
      markerEl.className = "custom-marker";

      const color = routeColors[index % routeColors.length];

      // High-Contrast Solid Styling
      markerEl.style.backgroundColor = color;
      markerEl.style.color = "#ffffff";
      markerEl.style.borderColor = "#ffffff";
      markerEl.style.borderStyle = 'solid';
      markerEl.style.borderWidth = '2px';

      // Inject the number (index within the day)
      markerEl.innerText = index + 1;

      if (stop.id === activeStopId) {
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
   * @param {string|null} activeDayId - The ID of the currently active day.
   */
  window.RouteCraft.refreshRouteLayer = function refreshRouteLayer(map, stops, routeColors, routeGeometries = [], activeDayId) {
    const features = [];

    // Filter stops by day and find their indices in the original list for geometry lookup
    const dayStopsWithIndices = stops
      .map((stop, index) => ({ stop, index }))
      .filter(item => !activeDayId || item.stop.dayId === activeDayId);

    for (let i = 0; i < dayStopsWithIndices.length - 1; i += 1) {
      const color = routeColors[i % routeColors.length];
      const origin = dayStopsWithIndices[i].stop;
      const destination = dayStopsWithIndices[i + 1].stop;
      
      // Geometry is stored in a flat list corresponding to the original stops array.
      // We need to find the geometry between these two specific stops.
      // If they were adjacent in the original list, we might have it.
      // HOWEVER, the routeGeometries is currently indexed by (original_index).
      // If we move stops between days, this might get complicated.
      // For now, let's assume routeGeometries is refreshed based on the filtered list in app.js
      // OR we just use the original index if they are still adjacent.
      
      const originalIdx = dayStopsWithIndices[i].index;
      const isActuallyAdjacent = dayStopsWithIndices[i+1].index === originalIdx + 1;
      
      const fallbackCoords = [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ];
      
      // Use cached geometry ONLY if they are adjacent in the original array
      // (This is a simplified assumption, app.js will need to refresh this)
      const coords = isActuallyAdjacent ? (routeGeometries[originalIdx] || fallbackCoords) : fallbackCoords;

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
