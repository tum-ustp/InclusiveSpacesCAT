---

# InclusiveSpace – CAT (Comfort-based Accessibility Tool)

CAT is a web GIS prototype for **comfort-based walking accessibility analysis** (catchment areas) with **multi-language UI (EN/DE/EL)**, a **Leaflet map**, and a **PostgreSQL + pgRouting** backend accessed via **Next.js API routes**.

---

## 1) Quick start (run locally)

### Installation

* Ensure you have Node.js v16+ installed.
* Clone the repository

```bash
git clone https://github.com/Huashu-z/InclusiveSpace.git
cd InclusiveSpace
```

Install dependencies:

```bash
npm install
```

### Development & Run
Start the development server:
```bash
npm run dev
```

Then visit: `http://localhost:3000/` 

### First-time usage (UI flow)

1. On landing page, pick a city (Hamburg / Penteli). This stores `selectedCity` and `selectedCityCenter` in `localStorage` and routes to `/user`. 
2. In the map page sidebar:

   * Set walking time & speed
   * Pick a start point (click on map or search address)
   * Enable comfort factors + adjust weights
   * Click **Get Catchment Area** to compute results

---

## 2) Project structure

```
components/
  plasmic/saa_s_website/        # Plasmic-generated pages & styles
  Header.jsx                    # Top bar: language switch, help dialog, city switch
  Sidebar.jsx                   # Container (composes sub-panels)
  Sidebar_AccessibilityControls.jsx
  Sidebar_VariableControls.jsx
  Sidebar_ManageLayers.jsx
  Sidebar_Tooltip.jsx
  MapComponent.jsx              # Leaflet map, data loading, analysis flow, results
  Legend.jsx                    # Results panel (per run metadata)
  LayerStyleManager.js          # Layer styling + WMS helpers
  cityVariableConfig.js         # City-specific availability (layers/features)
pages/
  index.jsx                     # Landing route "/"
  user.jsx                      # Map route "/user"
  api/
    accessibility.js            # pgRouting query endpoint -> GeoJSON roads
public/
  data/
    hamburg/                    # city GeoJSON layers + boundary
    penteli/
    POI/                        # POI GeoJSON groups
  locales/{en,de,el}/common.json# UI translations
styles/
  globals.css
next-i18next.config.js
next.config.mjs
plasmic.json / plasmic.lock
```

---

## 3) Tech Stack

### Frontend (Next.js + Plasmic + i18n)

* Next app wrapper + Plasmic provider is configured in `_app.jsx`. 
* HTML `<html lang="...">` follows Next locale via `_document.jsx`. 
* Text translations live in `public/locales/{en,de,el}/common.json` and are loaded in `pages/index.jsx` and `pages/user.jsx` via `serverSideTranslations`.
* Header supports:

  * Language switcher
  * Help dialog (keyboard focus trap + Esc close)
  * City switch dropdown (writes localStorage then navigates) 

### Map & analysis (Leaflet + Turf)

* `MapComponent.jsx` dynamically imports `react-leaflet` to avoid SSR issues. 
* Layer GeoJSON is loaded from `public/data/<city>/<layer>.geojson`. 
* POIs are loaded from `public/data/POI/*.geojson` and counted inside the computed polygon.
* Catchment area polygon is created from returned roads using Turf: `combine → simplify → buffer`, then area computed and stored as metadata.
* Results are tracked as:

  * A **default** result (only time/speed/start)
  * Optional **weighted** result (comfort factors applied)
  * Each run gets a color; legend can focus map bounds by result index

---

## 4) Backend API: `/api/accessibility`

### What it does

`pages/api/accessibility.js`:

1. Finds nearest pgRouting vertex to (lon,lat)
2. Runs `pgr_drivingDistance(...)`
3. Returns matched `ways` geometries as a GeoJSON FeatureCollection 

### City-specific routing tables

The API switches tables by `city` query param:

* Hamburg → `hh_ways`, `hh_ways_vertices_pgr`
* Penteli → `pt_ways`, `pt_ways_vertices_pgr` 

### Query parameters (frontend sends these)

* `lat`, `lon` (required)
* `time` (minutes), `speed` (km/h)
* `city` (`hamburg` / `penteli`)
* Comfort factor values (e.g., `noise`, `light`, `tree`, …) default to `1.0` if not enabled
* `n` = number of enabled variables (frontend appends `n = max(1, selected.length)`)

* Query example: 
    * http://localhost:3000/api/accessibility?city=hamburg&lat=53.5511&lon=9.9937&time=15&speed=4.8&n=1
    * http://localhost:3000/api/accessibility?city=hamburg&lat=53.5511&lon=9.9937&time=15&speed=4.8&noise=0.8&light=0.9&tree=0.7&n=3

---

## 5) Sidebar panels (what to modify)

### Accessibility controls

`Sidebar_AccessibilityControls.jsx` provides:

* walking time & speed sliders
* start point selection (map click mode + address search via Nominatim)
* keyboard support for address listbox + live region status messages 

### Comfort variables (weights)

`Sidebar_VariableControls.jsx`:

* Checkbox enables a variable
* Slider chooses one of predefined weight levels
* Tooltip per variable + overall info tooltip 

### Map layers

`Sidebar_ManageLayers.jsx`:

* City-dependent layer list
* Groups (env/phy/psy) + per-layer tooltip
* Reads `selectedCity` from localStorage 

---

## 6) Results & legend

`Legend.jsx` renders per-result metadata:

* time, speed, area, comfort ratio (for weighted runs)
* expand/collapse sections
* POI counts and category counts (if available)
* clicking a legend entry focuses map bounds to that result

---

## 7) Adding a new city (ops checklist)

**Database management and operation destails see in Database_instruction.pdf**

### A) Frontend city entry points (Landing + Header)

Add the city in **both** places so users can select it from the landing page and from the header dropdown.

1. **Landing page city card**
   File: `components/plasmic/saa_s_website/PlasmicLanding.jsx`

* Duplicate an existing city card block (Hamburg/Penteli)
* Update the click handler to call `enterCity("<cityId>", [lat, lon])`

This will set:

* `localStorage.selectedCity`
* `localStorage.selectedCityCenter`

2. **Header city dropdown**
   File: `components/Header.jsx`

* Add the new city entry to the `cities` list (id/name/center)
* Selection also updates the same localStorage keys above and navigates to `/user`

Add keys for the new city label/description (used on landing/header).
Add map thumbnail for landing city circle card under `public/images/`.

---

### B) Provide boundary + GeoJSON layer files (public data)

Create a city folder:

* `public/data/<cityId>/`

Add at minimum:

* `public/data/<cityId>/<cityId>_boundary.geojson`
* `public/data/<cityId>/<layerKey>.geojson` for each **GeoJSON** layer you want to display

4. **Register the new boundary in the map**
   File: `components/MapComponent.jsx`

* City boundaries are currently loaded via hardcoded fetch calls (Hamburg/Penteli).
* Extend that boundary loading block to include the new city boundary, OR refactor it to load dynamically from:

  * `/data/${city}/${city}_boundary.geojson`

---

### C) Register city layer + variable config (single source of truth)

File: `components/cityVariableConfig.js`

Add a new city entry in `cityLayerConfig` (or equivalent) including:

1. `mapLayers` (canonical manifest for this city)

* Each entry must be `{ key, type }`
* `type` must be `"geojson"` or `"wms"`

2. `discomfortFeatures` (variables supported by this city)

* Controls which comfort variables show up in the sidebar and are sent to the API

Example (conceptual):

```js
cityLayerConfig["<cityId>"] = {
  mapLayers: [
    { key: "streetlight", type: "geojson" },
    { key: "noise_wms", type: "wms" },
  ],
  discomfortFeatures: ["noise", "light", "tree", "crossing", "tactile"],
};
```

---

### D) Backend routing tables (pgRouting)
 
File: `pages/api/accessibility.js`

Add a `cityId` mapping for the new city to select the correct pgRouting tables:

* `waysTable` (edges table)
* `verticesTable` (vertices table)

Example (conceptual):

```js
if (cityId === "<cityId>") {
  waysTable = "<cityPrefix>_ways";
  verticesTable = "<cityPrefix>_ways_vertices_pgr";
}
```

---

## 8) Accessibility notes (important for maintenance)

This project includes a lot of keyboard and screen-reader handling:

* Header: skip links (Alt+N), focus management for help dialog, aria labels for nav tools 
* Sidebar: combobox/listbox semantics for address search + aria-live status updates 
* Map: sets a keyboard focusable container and adds stable aria labels for zoom buttons via MutationObserver 
* Legend: aria-live for “results loaded” and collapsible sections with aria-expanded / aria-controls 

---

## 9) Tests & validation

The project currently has a small test/validation set:

* `npm test` - runs Node test files matching `tests/accessibility-*.test.mjs`; currently covers accessibility API query behavior.
* `npm run lint` - runs Next.js/ESLint checks.
* `npm run build` - production build smoke check for the Next.js app.
* `npm run perf:accessibility` - runs `scripts/accessibility-load-test.mjs`, which sends parallel `/api/accessibility` requests for Hamburg in both default and weighted modes.

Useful examples:

```bash
npm test
npm run lint
npm run build
npm run perf:accessibility -- --url=http://localhost:3000 --count=9
```

---

## 10) Troubleshooting

### Map shows blank / crashes on SSR

`react-leaflet` is dynamically imported with `ssr: false` in `MapComponent.jsx`. If you move map logic, keep SSR constraints in mind. 

### API fails / returns empty geometry

* Check `/api/accessibility` query response in browser network tab
* Most common reasons:

  * DB connection issues
  * wrong city table mapping
  * no nearby vertex found (lat/lon)
  * pgRouting tables not populated 

### Layers not appearing

* Confirm file exists: `public/data/<city>/<layer>.geojson`
* Ensure the layer key is included in `availableLayers` (and/or in `cityVariableConfig.js`)
* Some layers may be WMS and are skipped from GeoJSON fetching logic

---

## 11) Deployment notes (current state)

* The app is a standard Next.js project; production build:

```bash
npm run build
npm start
```

* Backend runs as Next API routes (`/pages/api/*`) and therefore deploys together with the frontend.
