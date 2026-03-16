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
   * Determines styling properties for a route segment.
   * @param {Stop} origin - The origin stop.
   * @param {Stop} destination - The destination stop.
   * @param {string|number|null} activeStopId - ID of the currently selected stop.
   * @param {string|null} activeDayId - The ID of the currently active day.
   * @returns {Object} An object containing opacity, width, and isActive flags.
   */
  function getSegmentStyle(origin, destination, activeStopId, activeDayId) {
    const isConnectedToActive = activeStopId && (origin.id === activeStopId || destination.id === activeStopId);
    const isDayActive = activeDayId && origin.dayId === activeDayId;

    let opacity = 0.3;
    let width = 5;

    // If a specific day or stop is selected, hide routes from other days
    if (activeDayId && origin.dayId !== activeDayId) {
      opacity = 0;
      width = 0;
    } else if (isConnectedToActive) {
      opacity = 1.0;
      width = 10;
    } else if (isDayActive) {
      opacity = 0.7;
      width = 7.5;
    }

    return { opacity, width, isActive: !!isConnectedToActive };
  }

  /**
   * Generates a pre-calculated sequence of line-dasharray values for smooth forward marching ants.
   * @param {number} dashLength - Length of the dash.
   * @param {number} gapLength - Length of the gap.
   * @param {number} resolution - Number of frames in the cycle.
   * @returns {number[][]} Array of dasharray frames.
   */
  function generateDashArraySequence(dashLength = 4, gapLength = 4, resolution = 64) {
    const sequence = [];
    const totalCycle = dashLength + gapLength;
    
    // Build the sequence in reverse to fix the marching direction (forward)
    for (let i = resolution - 1; i >= 0; i--) {
      const s = (i / resolution) * totalCycle;
      if (s < dashLength) {
        // Part 1: First dash is shrinking, followed by gap, then second dash grows
        sequence.push([dashLength - s, gapLength, s, 0]);
      } else {
        // Part 2: Gap is shrinking, followed by dash, then second gap grows
        const sGap = s - dashLength;
        sequence.push([0, gapLength - sGap, dashLength, sGap]);
      }
    }
    return sequence;
  }

  // Cache the sequence globally for performance
  const MARCHING_ANTS_SEQUENCE = generateDashArraySequence();
  let animationRegistry = new WeakMap();

  /**
   * Starts a robust animation loop for a specific map layer.
   * Ensures only one requestAnimationFrame runs per map instance.
   * @param {Object} map - The map instance.
   * @param {string} layerId - The ID of the line layer to animate.
   */
  function startAntsAnimation(map, layerId) {
    // If already animating for this map, don't start another loop
    if (animationRegistry.has(map)) return;
    
    animationRegistry.set(map, true);
    let stepIdx = 0;

    function animate(timestamp) {
      if (!map.getStyle() || !map.getLayer(layerId)) {
        // Stop animation if map is unmounted or layer is gone
        animationRegistry.delete(map);
        return; 
      }

      // Speed control: ~32ms per step for smooth 30fps+ feel
      const newStepIdx = Math.floor((timestamp / 32) % MARCHING_ANTS_SEQUENCE.length);

      if (newStepIdx !== stepIdx) {
        map.setPaintProperty(layerId, "line-dasharray", MARCHING_ANTS_SEQUENCE[newStepIdx]);
        stepIdx = newStepIdx;
      }

      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
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
      
      // Show markers from other days ONLY if no specific day is selected
      if (activeDayId && stop.dayId !== activeDayId) {
        return;
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
   * @param {string|number|null} activeStopId - ID of the currently selected stop.
   */
  window.RouteCraft.refreshRouteLayer = function refreshRouteLayer(map, allStops, activeDayId, routeColors, routeGeometries = [], activeStopId = null) {
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

      // Use extracted helper for styling properties
      const styleProps = getSegmentStyle(origin, destination, activeStopId, activeDayId);

      features.push({
        type: "Feature",
        properties: { 
          color: color,
          opacity: styleProps.opacity,
          width: styleProps.width,
          isActive: styleProps.isActive
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
          "line-width": ["get", "width"],
          "line-opacity": ["get", "opacity"]
        }
      });
    } else {
      // Robustly update existing layer paint properties
      try {
        map.setPaintProperty("trip-route-line", "line-width", ["get", "width"]);
        map.setPaintProperty("trip-route-line", "line-opacity", ["get", "opacity"]);
        map.setPaintProperty("trip-route-line", "line-color", ["get", "color"]);
      } catch (e) {
        // Fallback: Re-create layer if data-driven styling fails to apply
        map.removeLayer("trip-route-line");
        map.addLayer({
          id: "trip-route-line",
          type: "line",
          source: "trip-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": ["get", "opacity"]
          }
        });
      }
    }

    // Add the "marching ants" dashed layer for active segments
    if (!map.getLayer("trip-route-ants")) {
      map.addLayer({
        id: "trip-route-ants",
        type: "line",
        source: "trip-route",
        layout: { "line-join": "round" }, // Removed line-cap: round to avoid dots
        filter: ["==", ["get", "isActive"], true],
        paint: {
          "line-color": "#ffffff",
          "line-width": 4,
          "line-dasharray": [0, 3, 3],
          "line-opacity": 0.9
        }
      });

      // Delegate to extracted animation loop manager
      startAntsAnimation(map, "trip-route-ants");
    } else {
      // Update the filter in case the selection changed
      map.setFilter("trip-route-ants", ["==", ["get", "isActive"], true]);
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
