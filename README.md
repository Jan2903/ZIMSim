# ZIMSim

Simulation of a Deutsche Bahn (DB) train display (ZugInfoMonitor / ZIM). The app renders authentic departure and arrival boards on an HTML canvas and can fetch live data from the DB IRIS API (optionally via a local DB bridge).

[https://jan2903.github.io/ZIMSim](https://jan2903.github.io/ZIMSim)

## Features

- Canvas-based rendering of authentic DB platform displays
- Departure board (Anschlusstafel), train indicator (Zuganzeiger), arrival board, coach position display, and train formation view
- Live data from the DB IRIS API with optional DB bridge for live coach formations
- Journey coupling (Flügelzug) and vehicle turnaround (Wende) handling
- Svelte 5 (Runes API) frontend, Vite build tool
- Tauri 2 wrapper for desktop (Windows, macOS, Linux) and mobile (Android)
- IndexedDB persistence via idb-keyval
- NRW regional display mode, audio announcements, and train line colors

## Data Sources

| Source | File | License | Link |
|---|---|---|---|
| DB Stations (StaDa) | `stations.csv` | CC BY 4.0 | [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace/apis/product/stada) |
| Extended & International Stations | `stations_ext.csv` | CC BY 4.0 | [Travel::Status::DE::IRIS](https://github.com/derf/Travel-Status-DE-IRIS) |
| Line Colors | `line-colors.json` | CC0-1.0 | [Traewelling line-colors](https://github.com/Traewelling/line-colors) |

## Setup & Commands

Requires **Node 20+** and npm. Python 3 is only needed for the bridge and `scripts/*.py`.

```bash
npm install
npm run dev          # Vite dev server on port 1420
npm run build        # runs codegen, then builds to dist/
npm run preview      # preview the built dist/
npm run check        # svelte-check (type/template validation)
npm run process:stations  # regenerate station/RIS data from CSVs
```

Tauri:

```bash
npm run tauri dev
npm run tauri build
npm run tauri android build
```

The local DB bridge (`scripts\start_bridge.bat` on Windows) runs `scripts/zimsim_bridge.py` on `127.0.0.1:8765` and is required for live coach formations / DB data in the browser and GitHub Pages builds.

## Status

This project is currently in beta/preview status. There is currently no app build / release with Svelte, and none is planned for the foreseeable future.

## License

GNU General Public License v3.0 (see `LICENSE`)
