window.RouteCraft = window.RouteCraft || {};

window.RouteCraft.createMapManager = function createMapManager(maplibreglRef) {
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

  function create(containerId, firstStop) {
    const map = new maplibreglRef.Map({
      container: containerId,
      style: getStyle(),
      center: [firstStop.longitude, firstStop.latitude],
      zoom: Math.min((firstStop.zoomLevel || 12) + 0.8, 18),
      maxZoom: 18,
      pitch: 0,
      bearing: 0
    });

    map.addControl(new maplibreglRef.NavigationControl(), "top-right");
    map.addControl(new maplibreglRef.ScaleControl({ maxWidth: 130, unit: "imperial" }), "bottom-right");
    return map;
  }

  function renderMarkers(map, stops, existingMarkers, activeIndex, routeColors) {
    existingMarkers.forEach((marker) => marker.remove());
    const markers = [];

    stops.forEach((stop, index) => {
      const markerEl = document.createElement("div");
      markerEl.className = "custom-marker";
      const color = routeColors[index % routeColors.length];
      markerEl.style.background = color;
      markerEl.style.boxShadow = `0 0 0 6px ${color}2B`;
      markerEl.classList.add("is-dim");
      if (index === activeIndex) {
        markerEl.classList.add("is-active");
      }

      const marker = new maplibreglRef.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(new maplibreglRef.Popup({ offset: 18 }).setHTML(`<strong>${stop.title}</strong>`))
        .addTo(map);

      markers.push(marker);
    });

    return markers;
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  function rgbToHex({ r, g, b }) {
    const toHex = (v) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mixColor(colorA, colorB, t) {
    const a = hexToRgb(colorA);
    const b = hexToRgb(colorB);
    return rgbToHex({
      r: Math.round(lerp(a.r, b.r, t)),
      g: Math.round(lerp(a.g, b.g, t)),
      b: Math.round(lerp(a.b, b.b, t))
    });
  }

  function refreshRouteLayer(map, stops, routeColors, routeGeometries = []) {
    const segments = [];

    for (let i = 0; i < stops.length - 1; i += 1) {
      const colorStart = routeColors[i % routeColors.length];
      const colorEnd = routeColors[(i + 1) % routeColors.length];

      const coords = routeGeometries[i] || [
        [stops[i].longitude, stops[i].latitude],
        [stops[i + 1].longitude, stops[i + 1].latitude]
      ];

      const steps = coords.length - 1;
      for (let s = 0; s < steps; s += 1) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const segmentColor = mixColor(colorStart, colorEnd, (t0 + t1) / 2);

        segments.push({
          type: "Feature",
          properties: { color: segmentColor },
          geometry: {
            type: "LineString",
            coordinates: [coords[s], coords[s+1]]
          }
        });
      }
    }
    const data = {
      type: "FeatureCollection",
      features: segments
    };

    if (!map.getSource("trip-route")) {
      map.addSource("trip-route", { type: "geojson", data });
    } else {
      map.getSource("trip-route").setData(data);
    }

    if (!map.getLayer("trip-route-glow")) {
      map.addLayer({
        id: "trip-route-glow",
        type: "line",
        source: "trip-route",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 7,
          "line-opacity": 0.35
        }
      });
    }

    if (!map.getLayer("trip-route-line")) {
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3.2
        }
      });
    }
  }

  function flyToStop(map, stop) {
    map.flyTo({
      center: [stop.longitude, stop.latitude],
      zoom: Math.min((stop.zoomLevel || 12) + 0.8, 18),
      duration: 1600,
      essential: true,
      pitch: 0,
      bearing: 0
    });
  }

  return {
    create,
    renderMarkers,
    refreshRouteLayer,
    flyToStop
  };
};
