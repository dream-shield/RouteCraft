# RouteCraft

RouteCraft is a browser-based travel itinerary planner that lets you search places, build and reorder stops on an interactive map, and export your trip data for sharing.

## Features

- Interactive map with OpenStreetMap basemap (MapLibre GL JS)
- Autocomplete place search (Photon)
- Add, edit, delete, and drag-and-drop reorder stops
- Auto-save and auto-load via localStorage
- Shareable URL (hash) with compressed itinerary data
- KML export and import
- Responsive layout for desktop and mobile (map top on mobile, list below; contained scroll)
- Color-coded route segments with gradients between stops
- Refined typography (Manrope)

## How It Works

- Use the `+` button to add a place.
- Search a place, enter a title, optional description, and zoom level.
- Drag stops using the handle to reorder the itinerary.
- The map animates to the active stop and updates the route line.
- Your changes auto-save in the browser.
- Use the link button to copy a shareable URL.

## Running Locally

This is a static site. Open `index.html` directly in a browser, or run a quick static server:

```bash
python3 -m http.server 8000
```

Then visit:

```
http://localhost:8000
```

## File Structure

```
index.html
styles/
  base.css
  components.css
  map.css
js/
  state.js
  utils.js
  search.js
  map.js
  main.js
todo.md
```

## Tech Stack

- MapLibre GL JS
- Vue 3 (CDN)
- Tailwind CSS (CDN)
- SortableJS
- Photon (geocoding autocomplete)

## Notes

- Autocomplete and map tiles require an internet connection.
- localStorage is per-browser and per-device.
- If both URL data and localStorage exist, you will be prompted to choose which to load.
- KML import expects Placemark points with coordinates.

## License

Add your preferred license here.
