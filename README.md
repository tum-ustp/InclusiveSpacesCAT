# InclusiveSpace - CAT (Comfort-based Accessibility Tool)

<p align="center">
  <img src="public/images/CAT_Purple.png" alt="CAT" height="72" />
</p>

<p align="center">
  <img src="public/images/logoIS_full.png" alt="InclusiveSpaces" height="48" />
  <img src="public/images/tum_logo_full.png" alt="Technical University of Munich" height="48" />
  <img src="public/images/logo_co-founded-eu_full.png" alt="Co-funded by the European Union" height="48" />
</p>

CAT is a web GIS prototype for **comfort-based walking accessibility analysis** (catchment areas) with **multi-language UI (EN/DE/EL)**, a **Leaflet map**, and a **PostgreSQL + pgRouting** backend accessed via **Next.js API routes**.

## Table of contents

1. [Quick start](#1-quick-start-run-locally)
   * [Supabase Setup](#supabase-setup)
   * [Frontend: Local Run or Vercel Deployment](#frontend-local-run-or-vercel-deployment)
2. [Project structure](#2-project-structure)
3. [Tech stack](#3-tech-stack)
4. [Backend API: `/api/accessibility`](#4-backend-api-apiaccessibility)
5. [Sidebar panels](#5-sidebar-panels-what-to-modify)
6. [Results and legend](#6-results-and-legend)
7. [Adding a new city](#7-adding-a-new-city-ops-checklist)
8. [Layer descriptions for Data Information](#8-layer-descriptions-for-data-information)
9. [Tests and validation](#9-tests-and-validation)
10. [Troubleshooting](#10-troubleshooting)
11. [Deployment notes](#11-deployment-notes-current-state)

## 1) Quick start (run locally)

### Installation

* Ensure you have Node.js v16+ installed.
* Clone the repository:

```bash
git clone https://github.com/tum-ustp/InclusiveSpacesCAT.git
cd InclusiveSpacesCAT
```

Install dependencies:

```bash
npm install
```

### Environment

Create `.env.local` from `env.example` and provide at least:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
NEXT_PUBLIC_CARTO_BASEMAP_KEY=your-carto-basemap-api-key
```

`DATABASE_URL` must point to a PostgreSQL/PostGIS/pgRouting database with the city routing tables described below.

### Supabase Setup

To run the project with your own database, create a free project in the [Supabase Dashboard](https://supabase.com/dashboard). Each Supabase project includes a PostgreSQL database. Once the project is created, use the **SQL Editor** (`SQL Editor -> New Query`) to run the SQL scripts provided in this repository. If the project uses spatial data, enable the **PostGIS** extension under `Database -> Extensions -> postgis`. Database connection details can be found by clicking **Connect** at the top of the project dashboard; copy the appropriate PostgreSQL connection string and use it in your application or database client. For more information, see the official Supabase documentation on [connecting to PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) and [PostGIS](https://supabase.com/docs/guides/database/extensions/postgis).

For a detailed guide on how to correctly prepare city data and upload it to Supabase via QGIS, see [How to add a new city - detailed guide](./How_to_add_new_city_DETAIL_English.pdf).

Example Python scripts for the data preparation workflow described in the guide can be found in the [data preprocessing folder](./data_preprocessing/).

### Development and run

Start the development server:

```bash
npm run dev
```

Then visit `http://localhost:3000/`.

### Frontend: Local Run or Vercel Deployment

The frontend can be run locally or deployed to Vercel. The important part is that the Supabase project is already deployed and the frontend has access to the required Supabase environment variables.

For local development, clone the repository, install the dependencies, add the required environment variables to your local `.env` / `.env.local` file, and start the development server, for example:

```bash
npm install
npm run dev
```

To deploy the frontend online, the simplest workflow is:

1. Create a repository on [GitHub](https://github.com/new).
2. Push the local project to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

GitHub also provides a detailed guide for uploading an existing local project:
https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github

3. Go to [Vercel](https://vercel.com), sign in with GitHub, and select:

`Add New -> Project -> Import`

Then choose the GitHub repository. Vercel usually detects the framework and build settings automatically. In most cases, the default settings can be kept and you can click **Deploy**.

Official Vercel deployment guide:
https://vercel.com/docs/deployments/git

4. Add the Supabase configuration in:

`Vercel Project -> Settings -> Environment Variables`

Add the same environment variables that the application uses locally, for example the Supabase project URL and public/anon key. The exact variable names depend on the frontend framework and this project's configuration.

After adding or changing environment variables, redeploy the project.

Vercel environment variables documentation:
https://vercel.com/docs/environment-variables

Supabase JavaScript client setup:
https://supabase.com/docs/reference/javascript/initializing

Once deployed, Vercel provides a public URL for the frontend. Future pushes to the connected GitHub repository can automatically trigger new deployments.

### First-time usage (UI flow)

1. On the landing page, pick a city: Hamburg, Penteli, or Munich. This stores `selectedCity` and `selectedCityCenter` in `localStorage` and routes to `/user`.
2. In the map page sidebar:

* Set walking time and speed.
* Pick a start point by clicking on the map or searching an address.
* Enable comfort factors and adjust weights.
* Click **Get Catchment Area** to compute results.

## 2) Project structure

```text
components/
  plasmic/saa_s_website/        # Plasmic-generated pages and styles
  Header.jsx                    # Top bar: language switch, help dialog, city switch
  Sidebar.jsx                   # Container for sidebar panels
  Sidebar_AccessibilityControls.jsx
  Sidebar_VariableControls.jsx
  Sidebar_ManageLayers.jsx
  Sidebar_Tooltip.jsx
  MapComponent.jsx              # Leaflet map, layer loading, analysis flow
  Legend.jsx                    # Results panel
  LayerStyleManager.js          # Layer styling, WMS helpers, grouped layers
  cityVariableConfig.js         # City-specific layer and variable availability
  poiConfig.js                  # Hamburg/Munich facility POI config
lib/
  accessibilityQueue.js         # In-memory queue for shared routing API
pages/
  index.jsx                     # Landing route "/"
  user.jsx                      # Map route "/user"
  api/
    accessibility.js            # pgRouting query endpoint
    layerdata.js                # legacy DB-backed layer endpoint
public/
  data/
    hamburg/                    # Hamburg GeoJSON layers and boundary
    munich/                     # Munich GeoJSON layers, POIs, and boundary
    penteli/                    # Penteli GeoJSON layers and boundary
    POI/                        # Shared POI GeoJSON groups
  images/
  locales/{en,de,el}/common.json
styles/
  globals.css
```

## 3) Tech stack

### Frontend (Next.js + Plasmic + i18n)

* Next app wrapper and Plasmic provider are configured in `_app.jsx`.
* HTML language follows the active Next locale via `_document.jsx`.
* Text translations live in `public/locales/{en,de,el}/common.json`.
* Header supports language switching, help dialog focus management, keyboard skip links, and city switching.

### Map and analysis (Leaflet + Turf)

* `MapComponent.jsx` dynamically imports `react-leaflet` to avoid SSR issues.
* Layer GeoJSON is loaded from `public/data/<city>/<layer>.geojson`.
* POIs are loaded from `public/data/POI/*.geojson` for Hamburg/Penteli and from `public/data/munich/*.geojson` for Munich.
* `components/cityVariableConfig.js` is the main frontend manifest for each city's visible layers and enabled comfort variables.
* The API returns server-generated polygon and network GeoJSON. The frontend stores results with metadata and displays them through `ReachabilityLayers` and `Legend`.

## 4) Backend API: `/api/accessibility`

### What it does

`pages/api/accessibility.js`:

1. Finds the nearest pgRouting vertex to `(lon, lat)`.
2. Runs `pgr_drivingDistance(...)`.
3. Selects reachable road geometries.
4. Buffers and simplifies output geometry server-side.
5. Returns polygon and network GeoJSON with timing metadata.

The API also uses `lib/accessibilityQueue.js` to serialize or group expensive routing calculations.

### City-specific routing tables

The API switches routing tables by the `city` query parameter:

* Hamburg: `hh_ways`, `hh_ways_vertices_pgr`
* Penteli: `pt_ways`, `pt_ways_vertices_pgr`
* Munich: `muc_ways_noded_4326_v2`, `muc_ways_vertices_pgr`

### Query parameters

* `lat`, `lon` are required.
* `time` is walking time in minutes.
* `speed` is walking speed in km/h.
* `city` is `hamburg`, `penteli`, or `munich`.
* `mode` is `default` or `weighted`.
* `geometry` can be `simplified`; otherwise full geometry is returned.
* Comfort factor values such as `noise`, `light`, `tree`, `trafficLight`, `tactile`, `facility`, etc. default to `1.0` if omitted.
* `requestId`, `queueGroupId`, and `queueGroupSize` are used by the frontend for queue coordination.
* `queueStatusId` returns queue status without running a routing query.

Examples:

```text
http://localhost:3000/api/accessibility?city=hamburg&lat=53.5511&lon=9.9937&time=15&speed=4.8&mode=default&geometry=simplified
http://localhost:3000/api/accessibility?city=munich&lat=48.1372&lon=11.5756&time=15&speed=4.8&mode=weighted&light=0.8&facility=0.7
```

## 5) Sidebar panels (what to modify)

### Accessibility controls

`Sidebar_AccessibilityControls.jsx` provides:

* walking time and speed sliders
* start point selection through map click mode and address search
* keyboard support for address listbox and live-region status messages

### Comfort variables

`Sidebar_VariableControls.jsx` provides:

* checkboxes to enable variables
* sliders for predefined weight levels
* tooltips for variables and general info

### Map layers

`Sidebar_ManageLayers.jsx`:

* reads the available city layers from `cityVariableConfig.js`
* shows city-dependent layer groups
* supports GeoJSON and WMS layer types

## 6) Results and legend

`Legend.jsx` renders per-result metadata:

* time, speed, area, and comfort ratio for weighted runs
* expand/collapse sections
* POI counts and category counts if available
* map focus when a legend entry is selected

## 7) Adding a new city (ops checklist)

This checklist assumes that the city routing tables and optional source datasets have already been loaded into Supabase/PostgreSQL. Database preparation details belong in `Database_instruction.pdf`; this section covers application wiring.

### A) Verify Supabase routing tables

The backend expects one edge table and one vertices table per city. Add the new city mapping in `CITY_CONFIG` inside `pages/api/accessibility.js`.

Required edge table columns:

* `gid`
* `source`
* `target`
* `cost`
* geometry column, usually `the_geom` or `geom`

Required vertices table columns:

* `id`
* geometry column, usually `the_geom` or `geom`

For weighted routing, the edge table also needs the weight columns used by `buildWeightedCostSql`, including:

```text
noise_weight
light_weight
trafficlight_weight
tactile_weight
tree_weight
temp_weight_s
temp_weight_w
blue_weight
green_weight
station_weight
wc_d_weight
path_width_weight
stair_weight
obstacle_weight
slope_weight
uneven_surfaces_weight
poor_pavement_weight
kerbs_h_weight
facilities_weight
pedestrian_flow_weight
```

Example `CITY_CONFIG` entry:

```js
newcity: {
  waysTable: "newcity_ways",
  verticesTable: "newcity_ways_vertices_pgr",
  edgeIdColumn: "gid",
  waysGeomColumn: "the_geom",
  verticesGeomColumn: "the_geom",
  supportsWeightedCosts: true,
  simplifyTolerance: 0.00005,
  bufferMeters: 20,
}
```

Smoke-test the API directly:

```text
/api/accessibility?city=newcity&lat=<lat>&lon=<lon>&time=15&speed=4.8&mode=default&geometry=simplified
```

### B) Add the city to UI entry points

Add the city in both places so users can select it from the landing page and from the map header.

* `components/plasmic/saa_s_website/PlasmicLanding.jsx`: add a city card that calls `enterCity("<cityId>", [lat, lon])`.
* `components/Header.jsx`: add the city to the header dropdown list with `id`, translation key, fallback name, and center.

These paths must set the same values as existing cities:

* `localStorage.selectedCity`
* `localStorage.selectedCityCenter`

Also add:

* city thumbnail under `public/images/`
* translation keys in `public/locales/{en,de,el}/common.json`

### C) Add public GeoJSON files

Create:

```text
public/data/<cityId>/
```

Add at minimum:

```text
public/data/<cityId>/<cityId>_boundary.geojson
```

For each local GeoJSON layer, add:

```text
public/data/<cityId>/<layerKey>.geojson
```

Current boundary loading in `components/MapComponent.jsx` is explicit, so add the new boundary fetch there as well.

### D) Register map layers and comfort variables

Update `components/cityVariableConfig.js`.

Each city entry needs:

* `discomfortFeatures`: controls which comfort variables are shown and sent to `/api/accessibility`
* `mapLayers`: controls which layers appear in the layer manager

Example:

```js
newcity: {
  discomfortFeatures: ["noise", "light", "trafficLight", "facility"],
  mapLayers: [
    { key: "newcity_noise_wms", type: "wms" },
    { key: "newcity_lighting", type: "geojson" },
    { key: "facility_newcity", type: "geojson" }
  ]
}
```

If one UI checkbox should load several concrete GeoJSON files, add a group in `components/LayerStyleManager.js` under `layerGroupMap`.

### E) Wire WMS, styles, and POI counts if needed

For WMS layers:

* add a component in `components/LayerStyleManager.js`
* register it in `wmsLayerComponents`
* use the same key in `cityVariableConfig.js`

For GeoJSON styling:

* add a `case` in `getStyle(layer, feature)`

For facility/POI counts:

* add POI layer config in `components/poiConfig.js` if the city uses grouped facility layers
* ensure `components/map/useCatchmentArea.js` knows where to load those POI files

### F) Validate end to end

Run:

```bash
npm test
npm run lint
```

Then test in the browser:

* landing page city card opens `/user?city=<cityId>`
* header city switch works
* city boundary appears
* GeoJSON/WMS layers load
* `/api/accessibility` returns polygon and network data for a known point inside the city

## 8) Layer descriptions for Data Information

Every layer shown in **Data Information** should have a human-readable description, source, and title. These texts are stored in the translation files:

```text
public/locales/en/common.json
public/locales/de/common.json
public/locales/el/common.json
```

Layer descriptions are read by `components/Sidebar_Tooltip.jsx` from the `tooltip_layer` object. The key must match the layer key used in `components/cityVariableConfig.js`.

Example:

```json
"tooltip_layer": {
  "newcity_lighting": {
    "title": "Street Lighting",
    "desc": "This dataset describes street segments or points with lighting information.",
    "source": "OpenStreetMap, 2026"
  }
}
```

For WMS layers or processed datasets, include the original source and processing method when relevant:

```json
"tooltip_layer": {
  "newcity_noise_wms": {
    "title": "Road Traffic Noise",
    "desc": "This layer visualizes modelled road traffic noise for the city.",
    "source": "City open data portal, 2026",
    "calculation": "For accessibility calculations, values were joined to nearby road-network segments and classified as a discomfort factor."
  }
}
```

If a layer key is reused by several cities but needs a city-specific description, add a city-specific key and map it in `Sidebar_Tooltip.jsx`. Existing example:

```js
const tooltipKey =
  city === "munich" && key === "trafic_light_wms"
    ? "munich_trafic_light_wms"
    : key;
```

Then add translations for `tooltip_layer.munich_trafic_light_wms` in all locale files.

Checklist when adding a new Data Information layer:

* Add the layer key to `components/cityVariableConfig.js`.
* Add `title`, `desc`, and `source` under `tooltip_layer.<layerKey>` in `en`, `de`, and `el`.
* Add `calculation` if the layer was processed before being used in routing weights.
* If one UI layer represents several GeoJSON files, register the group in `components/LayerStyleManager.js` and describe the grouped layer key.
* If a layer needs custom tooltip rendering beyond `title/source/desc`, update `components/Sidebar_Tooltip.jsx`.

## 9) Tests and validation

The project currently has a small test/validation set:

* `npm test` runs Node test files matching `tests/accessibility-*.test.mjs`.
* `npm run lint` runs Next.js/ESLint checks.
* `npm run build` runs a production build smoke check.
* `npm run perf:accessibility` runs `scripts/accessibility-load-test.mjs`, which sends parallel `/api/accessibility` requests.

Useful commands:

```bash
npm test
npm run lint
npm run build
npm run perf:accessibility -- --url=http://localhost:3000 --count=9
```

## 10) Troubleshooting

### Map shows blank or crashes on SSR

`react-leaflet` is dynamically imported with SSR disabled in `MapComponent.jsx`. Keep this constraint if moving map logic.

### API fails or returns empty geometry

Check `/api/accessibility` in the browser network tab. Common reasons:

* missing or invalid `DATABASE_URL`
* wrong city routing table mapping
* missing pgRouting extension or unpopulated routing tables
* missing geometry column or wrong geometry column name in `CITY_CONFIG`
* no nearby vertex for the selected `lat`/`lon`
* missing weighted columns when using `mode=weighted`

### Layers do not appear

* Confirm the file exists at `public/data/<city>/<layer>.geojson`.
* Ensure the layer key is included in `cityVariableConfig.js`.
* If the key is a group, ensure it is registered in `layerGroupMap`.
* WMS layers need a component in `LayerStyleManager.js` and an entry in `wmsLayerComponents`.

## 11) Deployment notes (current state)

The app is a standard Next.js project. Production build:

```bash
npm run build
npm start
```

Backend routes under `pages/api/*` deploy together with the frontend.
