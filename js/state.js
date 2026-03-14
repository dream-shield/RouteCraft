window.RouteCraft = window.RouteCraft || {};

window.RouteCraft.initialStops = [
  {
    id: 1,
    title: "Golden Gate Bridge",
    description: "Sunrise walk with views of the bay and Marin Headlands.",
    longitude: -122.4783,
    latitude: 37.8199,
    zoomLevel: 12.7,
    searchQuery: "Golden Gate Bridge",
    transportMode: null
  },
  {
    id: 2,
    title: "Yosemite Valley",
    description: "Afternoon at Tunnel View and lower Yosemite Falls.",
    longitude: -119.573,
    latitude: 37.7456,
    zoomLevel: 11.6,
    searchQuery: "Yosemite Valley",
    transportMode: "auto"
  },
  {
    id: 3,
    title: "Las Vegas Strip",
    description: "Evening lights, shows, and a late-night food stop.",
    longitude: -115.1728,
    latitude: 36.1147,
    zoomLevel: 12.8,
    searchQuery: "Las Vegas Strip",
    transportMode: "auto"
  },
  {
    id: 4,
    title: "Grand Canyon South Rim",
    description: "Golden-hour overlook at Mather Point and nearby trails.",
    longitude: -112.1401,
    latitude: 36.0544,
    zoomLevel: 11.4,
    searchQuery: "Grand Canyon South Rim",
    transportMode: "auto"
  },
  {
    id: 5,
    title: "Santa Monica Pier",
    description: "Trip finale by the Pacific with sunset boardwalk views.",
    longitude: -118.4961,
    latitude: 34.0094,
    zoomLevel: 13,
    searchQuery: "Santa Monica Pier",
    transportMode: "auto"
  }
];

window.RouteCraft.createEmptyForm = function createEmptyForm() {
  return {
    query: "",
    title: "",
    description: "",
    zoomLevel: 12,
    latitude: null,
    longitude: null,
    searchQuery: "",
    transportMode: "auto"
  };
};
