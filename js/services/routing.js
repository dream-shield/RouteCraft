/**
 * @fileoverview Service for fetching route geometries between stops using
 * the Stadia Maps Routing API.
 */

window.RouteCraft = window.RouteCraft || {};

(function routingModule() {
  /**
   * Decodes a polyline6 string into an array of [lng, lat] coordinate pairs.
   * polyline6 is a space-efficient format used by many routing engines.
   * @param {string} str - The encoded polyline string.
   * @returns {number[][]} Array of coordinate pairs.
   */
  function decodePolyline6(str) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];
    const precision = 1e6;

    while (index < str.length) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;

      coordinates.push([lng / precision, lat / precision]);
    }
    return coordinates;
  }

  /**
   * Fetches the route geometry for a single segment between two stops.
   * Falls back to a straight line if the API call fails or no key is provided.
   * @param {Stop} start - The starting stop of the segment.
   * @param {Stop} end - The ending stop of the segment.
   * @param {TransportMode} mode - The mode of transport (auto, bicycle, pedestrian).
   * @param {string} apiKey - The Stadia Maps API key.
   * @returns {Promise<number[][]>} A promise resolving to the coordinate array for the segment.
   */
  window.RouteCraft.fetchRouteSegment = async function fetchRouteSegment(start, end, mode, apiKey) {
    if (!apiKey || apiKey === "YOUR_STADIA_API_KEY") {
      return [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude]
      ];
    }

    const costing = mode === "pedestrian" ? "pedestrian" : (mode === "bicycle" ? "bicycle" : "auto");

    const body = {
      locations: [
        { lat: start.latitude, lon: start.longitude },
        { lat: end.latitude, lon: end.longitude }
      ],
      costing: costing,
      units: "miles"
    };

    try {
      const response = await fetch(`https://api.stadiamaps.com/route/v1?api_key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error("Routing request failed");

      const data = await response.json();
      const shape = data.trip?.legs?.[0]?.shape;
      if (!shape) throw new Error("No shape in response");

      return decodePolyline6(shape);
    } catch (error) {
      console.error("Routing error:", error);
      return [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude]
      ];
    }
  };
})();
