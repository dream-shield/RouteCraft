# RouteCraft TODO

Feature roadmap for the travel itinerary app.

## Quick Wins

- [√] Save/Load Itinerary (localStorage + optional JSON import/export)
- [√] Shareable Link (optimized v2 URL format with compressed positional arrays)
- [√] KML Export/Import (compatible with Google Earth)
- [ ] Map Fit + Bounds ("fit all stops" and optional trip bounds)
- [ ] Stop Categories + Icons (custom marker styles by type)
- [ ] Validation + Quality (logic handles duplicates and missing data; needs inline form feedback)
- [ ] In bulk add mode, instead of just showing the first result, show a drop down of the top 5 results.

## Next Phase

- [√] Transport Mode (driving/walking/cycling per segment)
- [ ] Route Distance + ETA (per leg + total summary)
- [ ] Day/Time Planning (multi-day support is DONE; needs scheduling + conflict warnings)
- [ ] Google Maps Links (directions between segments + day-wide waypoint links)
- [√] Batch Import (import multiple places from free-form text)
- [ ] Undo/Redo (revert edits, deletes, and reorder actions)
- [ ] PWA Offline Mode (installable app + cached itinerary data)

## Bugs
- [ ] When going to edit mode in Bulk Add, the previous text should be preserved
- [ ] When a place or day is selected, the places from the other days should be hidden