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

  function renderMarkers(map, stops, existingMarkers) {
    existingMarkers.forEach((marker) => marker.remove());
    const markers = [];

    stops.forEach((stop) => {
      const markerEl = document.createElement("div");
      markerEl.className = "custom-marker";

      const marker = new maplibreglRef.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(new maplibreglRef.Popup({ offset: 18 }).setHTML(`<strong>${stop.title}</strong>`))
        .addTo(map);

      markers.push(marker);
    });

    return markers;
  }

  function refreshRouteLayer(map, stops) {
    const coordinates = stops.map((stop) => [stop.longitude, stop.latitude]);
    const data = {
      type: "FeatureCollection",
      features: coordinates.length >= 2
        ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } }]
        : []
    };

    if (!map.getSource("trip-route")) {
      map.addSource("trip-route", { type: "geojson", data });
      map.addLayer({
        id: "trip-route-glow",
        type: "line",
        source: "trip-route",
        paint: { "line-color": "#60a5fa", "line-width": 7, "line-opacity": 0.45 }
      });
      map.addLayer({
        id: "trip-route-line",
        type: "line",
        source: "trip-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1d4ed8", "line-width": 3 }
      });
      return;
    }

    map.getSource("trip-route").setData(data);
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
