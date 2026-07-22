# SPEC — requirement log

One row per requirement/ask, appended when it arrives. This file ships empty in the template — it belongs to the app YOU build. Log the requirement in the requester's own words, track it to journey-green, keep the evidence link (journey name, file, or URL). The row is done only when a journey proves the visible outcome.

| # | Ask (requester's words) | Status (asked → built → journey-green) | Evidence | Date |
|---|---|---|---|---|
| 1 | Take the map view to full-fidelity depth — "make it feel like Google Maps": basemap switcher (streets/satellite/dark/terrain), layer toggles + heatmap + clustering controls, color/size markers + legend, draw/measure + filter-by-area, search + geocode, route between records, click-to-add — all config-composable | journey-green | `journeys/extra/map-view.mjs` (17 journeys) + `journeys/unit/map-depth.test.ts` (22 unit tests); `docs/RECIPES.md` "Give an object a map view" | 2026-07-22 |
