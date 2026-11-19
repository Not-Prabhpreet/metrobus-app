# Validation record

Checked locally on November 19, 2026 against the retained official Metrobus GTFS feed.

The production build, all eight unit tests, and all eight browser tests passed locally. GitHub Actions also passed the implementation checks. The private hosted app was published after owner approval.

- Unit tests: service-day boundaries, 24:00+ times, Newfoundland spring/fall DST, calendar overrides, countdown formatting, coverage boundaries, directional headways, distinct-trip metrics, and service-gap boundaries.
- Chrome browser checks: stop search, keyboard saving and navigation, persistent saved stops, timetable expansion, route lists and map alternatives, on-device geolocation, offline reload with cached schedule, dashboard day changes, stable sorting, chart data fallback, route pagination, and empty/error states.
- Automated accessibility scans: Nearby, Search, Saved, Stop detail, Route detail, and desktop/mobile Insights. WCAG 2 A/AA, 2.1 AA, and 2.2 AA rules enabled. A passing automated scan is not a full WCAG conformance certification.
- Responsive check: 390 px mobile, 1440 px desktop, and 320 px with 200% root text sizing; no page-level horizontal overflow in the dashboard.
- Lighthouse local production audit: performance **97**, accessibility **100**, best practices **100**. Scores vary by device, browser, hosting, and network. The report identified a loading-state layout shift and unused JavaScript as remaining optimization opportunities.

The rider app and dashboard were visually reviewed against the PDF screenshots. Invented screenshot values were replaced with actual feed values; first-run empty saved stops and explicit location permission replace the populated mock's assumed user state.

GitHub Pages migration: all nine browser tests passed at both `/` and `/metrobus-app/`, including reload without network; all eight unit tests also passed. A hosting test checks asset fetches, manifest icon/start/scope paths, worker registration scope, and cached URLs. The primary deployment is public and requires no account login.
