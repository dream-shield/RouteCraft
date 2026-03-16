# RouteCraft TODO

Feature roadmap for the travel itinerary app.

When working on each item, plan it first. Get confirmation from the

## Bugs

- [x] When going to edit mode in Bulk Add, the previous text should be preserved
- [x] When a place or day is selected, the routes from the other days should be hidden
- [x] When clicking on a day, do not collapse it, just select it, along with the first place from the day, if no place for that day is selected

## Features

- [ ] Map Fit + Bounds ("fit all stops" and optional trip bounds)
- [ ] In bulk add mode, instead of just showing the first result, show a drop down of the top 5 results.
- [ ] Google Maps Links (directions between segments + day-wide waypoint links)
- [ ] Route Distance + ETA (per leg + total summary, maybe adjacent chip)
- [ ] Undo/Redo (revert edits, deletes, and reorder actions)

## Architectural Notes

### Data Model & Routing Integrity
- **The Issue**: Routing and map rendering rely on adjacent stops in the global `stops` array sharing the same `dayId`. Because the UI uses a grouped view (Days) but the data is a flat list, manual insertion/reordering was brittle and easily resulted in "scrambled" data where logical siblings were separated by stops from other days, breaking routes.
- **The Solution**: Implemented a **Self-Healing Data Model**. Instead of relying on manual index management, the store now enforces chronological grouping via `sortStopsByDay()`. This runs automatically on:
    - Initial load (restores integrity from potentially bad stored data).
    - Adding a new stop.
    - Updating a day's date (moves the entire group of stops to its new chronological position).
- **Future Consideration**: If the itinerary grows very large, consider switching from a flat array to a nested `days -> stops` structure to eliminate the need for global sorting entirely.

