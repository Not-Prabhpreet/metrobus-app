# Metrobus Next

A mobile-first rider app and service planning dashboard for Metrobus in St. John's, Newfoundland and Labrador, using public GTFS schedule data.

## Project status

Primary hosting is [GitHub Pages](https://not-prabhpreet.github.io/metrobus-app/), which opens without signing in.

The first implementation includes stop search, on-device nearby stops, saved stops, scheduled departure countdowns, full timetables, route directions and shape previews, offline PWA caching, dark mode, and responsive service insights.

All routes, stops, times, and metrics come from the retained official feed, currently valid October 26, 2026 through January 3, 2027. Times are scheduled. This app does not provide live vehicle tracking.

## Run locally

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

The development server prints its local URL. To test the production app, including offline behavior:

```sh
npm run build
npm run preview
```

Offline saving requires HTTPS or localhost and one successful connected visit. The service worker caches the app shell, bundled fonts, and complete precomputed schedule. It never sends the rider's location to a server. Saved stops and appearance preferences stay in browser storage.

## Validation

```sh
npm test
npm run build
npm run test:e2e
```

Browser checks use installed Google Chrome locally. CI installs Playwright Chromium. They cover rider flows, day toggles and sorting, accessibility scans, offline reload, dark mode, and narrow-screen reflow. Unit tests cover GTFS service-day arithmetic, Newfoundland daylight saving changes, calendar exceptions, and service metrics.

## Update the schedule

```sh
npm run data:refresh
```

Refresh at least weekly, as required by the data provider. Commit `data/google_transit.zip` and `data/source.json`, then rebuild and redeploy. A normal build uses the retained ZIP, so it is reproducible without downloading a new feed. A failed validation stops the build before replacing derived output. See [data sources and metric definitions](docs/DATA.md).

## Stack and layout

React, TypeScript and Vite, with CSS variables implementing the brief's light/dark design tokens. Temporal handles service instants; CSV and ZIP parsing happens at build time.

- `scripts/build-data.mjs`: validated feed conversion and summary metrics.
- `src/lib/`: shared service-time and metric calculations.
- `src/App.tsx`: rider screens and local preferences.
- `src/Insights.tsx`: dashboard, chart, sorting, and data-quality checks.
- `scripts/sw-template.js`: production offline behavior.
- `public/data/`: generated JSON, including per-stop files; excluded from Git.
- `.github/workflows/pages.yml`: tested public deployment to GitHub Pages.
- `.openai/hosting.json`: retained metadata for the earlier private host; GitHub Pages is the primary deployment destination.

Installability and storage availability depend on the browser. The app reports unavailable persistent storage rather than assuming a save succeeded. A stale feed remains inspectable and displays its age; departure search never invents service beyond calendar validity.

## GitHub Pages deployment

Changes merged into `main` run the Pages workflow: unit tests, a production build using `VITE_BASE_PATH=/metrobus-app/`, browser checks at that same path, and deployment of `dist/`. The workflow can also be run manually through GitHub Actions. The app uses hash routes, so stop and route links work without server rewrite rules.

The manifest, fonts, schedule fetch and scoped service worker support the repository subdirectory. Local development defaults to `/`. To test the Pages build locally, set `VITE_BASE_PATH=/metrobus-app/` for both `npm run build` and `npm run test:e2e`.

## Development workflow

Use separate branches for coherent features and fixes, make meaningful commits, and push progress regularly during development. Keep `main` stable.

The design brief is maintained locally and is excluded from this public repository.

Independent concept built on Metrobus public data. Not affiliated with the St. John's Transportation Commission.
