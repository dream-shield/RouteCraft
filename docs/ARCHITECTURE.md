# RouteCraft Architectural Overview

This document describes the high-level architecture, namespacing patterns, and data flow of the RouteCraft application.

## Core Principles

RouteCraft is built as a modular, client-side-only application using a "modern ESM-lite" approach. It prioritizes simplicity, portability, and clean separation of concerns without the need for a complex build step.

- **Vanilla-First:** Uses standard browser features and lightweight libraries via CDN.
- **Namespaced Logic:** All core business logic is encapsulated under the `window.RouteCraft` namespace.
- **Stateless Services:** Services are generally stateless, acting as functional units that operate on data passed to them.

## Namespacing & Global State

To avoid global scope pollution while maintaining accessibility, the app uses a single global object: `window.RouteCraft`.

- **`js/core/state.js`**: Defines the application's initial data and shared JSDoc types.
- **`js/core/utils.js`**: Contains general-purpose utility functions (e.g., `debounce`, `clampZoom`).

## Services (Business Logic)

Services reside in `js/services/` and are attached to `window.RouteCraft`. They handle specific domains of functionality:

| Service | Responsibility |
| :--- | :--- |
| `ItineraryService` | Manages the list of stops (sanitization, adding, reordering, deleting). |
| `MapService` | Orchestrates MapLibre GL JS (initialization, markers, route layers, camera movement). |
| `RoutingService` | Interfaces with external APIs (like Stadia Maps) to fetch route geometries. |
| `SearchService` | Handles location geocoding and search suggestion scoring. |
| `KmlService` | Manages KML data generation (export) and parsing (import). |
| `StorageService` | Handles persistence via `LocalStorage` and `URL Hash` (using LZ-string compression). |

## UI Architecture (Vue.js)

The UI is built with **Vue.js 3** using the **Options API**.

### Components
Components are defined in `js/components/` as plain JavaScript objects. They use X-Templates defined in `index.html` to separate markup from logic.

- **`PlaceCard`**: Displays individual itinerary items (Stops) and provides controls for editing/deleting.
- **`AddStopMenu`**: A dropdown/overlay for searching and adding new Places.
- **`SourcePrompt`**: A modal used to resolve data conflicts between local storage and URL parameters.

### Application Entry (`js/app.js`)
The main Vue instance coordinates between the components and services. It maintains the "Single Source of Truth" for the itinerary state and triggers service calls in response to user actions or state changes.

## Data Flow

1.  **Initialization:** 
    - `app.js` checks `StorageService` for data in the URL hash and then `LocalStorage`.
    - If a conflict exists, `SourcePrompt` is shown.
    - `ItineraryService` sanitizes the chosen data.
2.  **State Change:**
    - User modifies the itinerary (e.g., adds a stop).
    - `app.js` updates its `stops` array.
    - A `watch` on the `stops` array triggers `StorageService` to save to LocalStorage and the URL hash.
3.  **Visual Update:**
    - `app.js` calls `MapService.syncMapData()` to update markers and route lines.
    - Vue's reactivity system automatically updates the sidebar list.
4.  **Routing:**
    - When stops are added or transport modes change, `RoutingService` is called to fetch new segment geometries.
    - These geometries are stored in `routeGeometries` and rendered by `MapService`.

## External Dependencies

The application relies on several high-quality libraries via CDN:

- **Vue.js 3**: UI framework and reactivity.
- **MapLibre GL JS**: High-performance interactive mapping.
- **Tailwind CSS**: Utility-first styling.
- **Sortable.js**: Drag-and-drop reordering logic.
- **LZ-String**: Compression for encoding itinerary data into short URL hashes.
- **Photon API**: Open-source geocoding and search suggestions.
- **Stadia Maps API**: Routing and route geometry generation.
