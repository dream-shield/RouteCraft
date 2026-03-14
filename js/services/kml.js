/**
 * @fileoverview Service for generating and parsing KML (Keyhole Markup Language)
 * files to support itinerary export and import.
 */

window.RouteCraft = window.RouteCraft || {};

(function kmlModule() {
  /**
   * Escapes special characters for XML to prevent parsing errors.
   * @param {string} text - The text to escape.
   * @returns {string} The XML-safe string.
   */
  function escapeXml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Generates a KML string from an array of stops.
   * @param {Stop[]} stops - The itinerary stops to export.
   * @returns {string} A complete, valid KML document string.
   */
  window.RouteCraft.generateKml = function generateKml(stops) {
    const placemarks = stops.map(stop => `    <Placemark>
      <name>${escapeXml(stop.title)}</name>
      <description>${escapeXml(stop.description || "")}</description>
      <Point>
        <coordinates>${stop.longitude},${stop.latitude},0</coordinates>
      </Point>
    </Placemark>`).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>RouteCraft Itinerary</name>
${placemarks}
  </Document>
</kml>`;
  };

  /**
   * Parses a KML string into an array of stop objects.
   * @param {string} text - The raw KML content to parse.
   * @returns {Stop[]|null} An array of parsed stops or null if parsing fails.
   */
  window.RouteCraft.parseKml = function parseKml(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return null;

    const placemarks = Array.from(doc.getElementsByTagName("Placemark")).map((p, idx) => {
      const name = p.getElementsByTagName("name")[0]?.textContent?.trim() || `Stop ${idx + 1}`;
      const coordsText = p.getElementsByTagName("coordinates")[0]?.textContent?.trim();
      if (!coordsText) return null;

      const firstCoord = coordsText.split(/\s+/)[0];
      const [lonText, latText] = firstCoord.split(",");
      const longitude = Number(lonText);
      const latitude = Number(latText);

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

      return {
        id: idx + 1,
        title: name,
        description: p.getElementsByTagName("description")[0]?.textContent?.trim() || "",
        longitude,
        latitude,
        zoomLevel: 12,
        searchQuery: name
      };
    }).filter(Boolean);

    return placemarks.length > 0 ? placemarks : null;
  };
})();
