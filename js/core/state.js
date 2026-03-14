/**
 * @fileoverview Core state and initial data for RouteCraft.
 * Defines the shared data structures used across the application.
 */

window.RouteCraft = window.RouteCraft || {};

/**
 * @typedef {('auto'|'bicycle'|'pedestrian')} TransportMode
 * The mode of transport for a route segment.
 */

/**
 * @typedef {Object} Stop
 * @property {number} id - Unique identifier for the stop.
 * @property {string} title - Display title of the stop.
 * @property {string} description - Brief description of the stop.
 * @property {number} longitude - WGS84 longitude.
 * @property {number} latitude - WGS84 latitude.
 * @property {string} searchQuery - The original search string used to find this place.
 * @property {TransportMode|null} transportMode - Mode used to reach this stop from the previous one.
 */

/**
 * @typedef {Object} ItineraryPayload
 * @property {Stop[]} stops - Array of stops in the itinerary.
 * @property {number} activeIndex - The index of the currently focused stop.
 */

/**
 * Initial set of stops displayed when the app loads without saved data.
 * @type {Stop[]}
 */
window.RouteCraft.initialStops = [
  {
    id: 1,
    title: "Golden Gate Bridge",
    description: "Sunrise walk with views of the bay and Marin Headlands.",
    longitude: -122.4783,
    latitude: 37.8199,
    searchQuery: "Golden Gate Bridge",
    transportMode: null,
    dayId: "day-1"
  },
  {
    id: 2,
    title: "Yosemite Valley",
    description: "Afternoon at Tunnel View and lower Yosemite Falls.",
    longitude: -119.573,
    latitude: 37.7456,
    searchQuery: "Yosemite Valley",
    transportMode: "auto",
    dayId: "day-1"
  },
  {
    id: 3,
    title: "Las Vegas Strip",
    description: "Evening lights, shows, and a late-night food stop.",
    longitude: -115.1728,
    latitude: 36.1147,
    searchQuery: "Las Vegas Strip",
    transportMode: "auto",
    dayId: "day-1"
  },
  {
    id: 4,
    title: "Grand Canyon South Rim",
    description: "Golden-hour overlook at Mather Point and nearby trails.",
    longitude: -112.1401,
    latitude: 36.0544,
    searchQuery: "Grand Canyon South Rim",
    transportMode: "auto",
    dayId: "day-1"
  },
  {
    id: 5,
    title: "Santa Monica Pier",
    description: "Trip finale by the Pacific with sunset boardwalk views.",
    longitude: -118.4961,
    latitude: 34.0094,
    searchQuery: "Santa Monica Pier",
    transportMode: "auto",
    dayId: "day-1"
  }
];

/**
 * Creates a fresh, empty form object for stop creation and editing.
 * @returns {Object} A new form state object.
 */
window.RouteCraft.createEmptyForm = function createEmptyForm() {
  return {
    query: "",
    title: "",
    description: "",
    latitude: null,
    longitude: null,
    searchQuery: "",
    transportMode: "auto"
  };
};
