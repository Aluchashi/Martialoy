# Martialoy — Build Plan

Status: **Phase 0 complete; Phase 2 engine complete; Phase 1 data pending** · Owner: Md. Imran Hasan · Last updated: 2026-10-20

This document turns the README concept into a sequenced build. It is deliberately
short on prose and long on contracts, because the frontend, the compute engine and
the data pipeline are built by different people in parallel.

---

## 1. Product slice (MVP, one region)

One region: **Jezero Crater**. Everything else is out of scope for the hackathon build.

```
select profile (Human | Rover)
        |
draw polyline on local PMTiles basemap
        |
sample DEM every N metres -> slope profile -> energy + time + verdict
        |
survival card: distance, time, energy, max slope, PASS/FAIL, assumptions
        |
on FAIL: name the failing segment, over-limit amount, offer least-cost contingency
```

Hard requirements from the brief:

| # | Requirement | Where it lands |
|---|---|---|
| R1 | Local PMTiles basemap from NASA Mars Trek | `cache/mars/*.pmtiles`, MapLibre raster/vector source |
| R2 | Regional DEM as COG, sampled locally | `cache/mars/*.tif`, `src/compute/dem.py` |
| R3 | Fixed-spacing elevation + slope sampling | `src/compute/route.py::sample_route` |
| R4 | Distance, climb, time, Wh, over-limit bool | `src/compute/route.py::summarise` |
| R5 | Dijkstra least-cost path, distance + slope penalty | `src/compute/graph.py` |
| R6 | Synthetic-ramp unit test | `tests/test_route.py` |
| R7 | Draw tool + profile chart + survival card | `src/web` |
| R8 | Failing segment + contingency route | `FailurePanel`, `/api/contingency` |
| R9 | All assumptions visible in UI | `/api/profiles` -> `Assumptions` table |
| R10 | Apache-2.0, public repo, NASA/PDS citation | `LICENSE`, README, `docs/references.md` |

Definition of done: all ten rows demonstrable in one 240-second screen recording,
with airplane mode on.

---

## 2. Architecture

Everything runs on one machine. No runtime third-party tile or terrain service.

```
┌──────────────────────────── browser ────────────────────────────┐
│  React + TypeScript                                             │
│  MapLibre GL ── pmtiles:// protocol ── /mars/basemap.pmtiles    │
│  Draw layer (GeoJSON)        Elevation profile (SVG)            │
│  Survival card · Assumptions table · Failure panel              │
└───────────────────────────────┬─────────────────────────────────┘
                                │ JSON (POST /api/route)
┌───────────────────────────────▼─────────────────────────────────┐
│  FastAPI (uvicorn, 127.0.0.1:8000)                              │
│  route.py   sampling · slope · energy · verdict (pure numpy)    │
│  graph.py   Dijkstra / A* over DEM grid                         │
│  dem.py     rasterio COG window read · bilinear sample          │
│  profiles/  rover.toml · human.toml (single source of truth)    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ local file reads
┌───────────────────────────────▼─────────────────────────────────┐
│  cache/mars/  jezero.pmtiles · jezero_dem.tif · manifest.json   │
└─────────────────────────────────────────────────────────────────┘
```

Serving: FastAPI mounts `src/web/dist` at `/` and `cache/mars` at `/mars`.
Dev: Vite on 5173 proxies `/api` and `/mars` to 8000. The web app has a clearly
labelled **demo engine** fallback so UI work never blocks on the DEM.

---

## 3. Repository layout (target)

```
.
├── LICENSE                     Apache-2.0
├── README.md
├── cache/mars/                 git-ignored payload + committed manifest example
│   ├── manifest.json
│   ├── jezero.pmtiles
│   └── jezero_dem.tif
├── docs/
│   ├── PLAN.md                 this file
│   ├── references.md           every constant -> source URL
│   └── data.md                 how the cache was produced (product IDs, commands)
├── scripts/
│   ├── fetch_mars_data.py      optional helper; manual placement is acceptable
│   └── check_data.py           validates manifest, bbox, nodata, CRS
├── src/
│   ├── compute/
│   │   ├── __init__.py
│   │   ├── api.py              FastAPI app + models
│   │   ├── geo.py              spherical geometry + fixed-spacing sampler
│   │   ├── route.py            sampling + energy + verdict
│   │   ├── graph.py            Dijkstra least-cost path
│   │   ├── dem.py              COG adapter (lazy rasterio)
│   │   ├── profiles.py         TOML loader -> API assumption table
│   │   └── profiles/{rover,human}.toml
│   └── web/                    Vite app (this scaffold)
└── tests/
    ├── test_route.py           synthetic ramp, known gradient
    ├── test_graph.py           synthetic cone / wall
    └── test_api.py             contract smoke test
```

---

## 4. Data pipeline

### 4.1 Products

| Layer | Product | Notes |
|---|---|---|
| Basemap | NASA Mars Trek regional mosaic, exported/cached as PMTiles | Keep z8–z13 for Jezero; target < 150 MB |
| DEM | Jezero stereo DTM (HiRISE/CTX) or Mars Trek blended DEM, COG | 20–50 m/px is enough for slope; 1 m is unnecessary and slow |
| Science (stretch) | CRISM mineral detections | Only after R1–R10 pass |

Record in `docs/data.md`: product title, product ID, download date, licence,
original CRS, vertical datum, pixel size, and the exact command that produced the
cached files. This is the audit trail judges and PDS links rely on.

### 4.2 Cache contract

`cache/mars/manifest.json` is the only path the app knows:

```json
{
  "region": "jezero",
  "label": "Jezero Crater",
  "bbox": [77.38, 18.34, 77.72, 18.58],
  "center": [77.58, 18.44],
  "basemap": { "file": "jezero.pmtiles", "type": "raster", "tileSize": 256,
               "attribution": "NASA Mars Trek" },
  "dem": { "file": "jezero_dem.tif", "crs": "IAU_2015:104903",
           "vertical_datum": "Mars areoid", "resolution_m": 25,
           "nodata": -32768 },
  "sources": [
    { "name": "NASA Mars Trek", "url": "https://trek.nasa.gov/mars/" },
    { "name": "NASA Planetary Data System", "url": "https://pds.nasa.gov/" }
  ]
}
```

### 4.3 Geometry rules (write these down, they bite)

- Mars is treated as a sphere of **R = 3,389,500 m**.
- DEM coordinates are **planetocentric** lat/lon (IAU 2015). Verify
  `latitude_type` in the GeoTIFF metadata; planetographic input must be converted
  before sampling, otherwise routes shift north/south and slopes are wrong.
- Horizontal distance between samples: local equirectangular scaling at the mean
  latitude (`dx = Δλ·R·cosφ`, `dy = Δφ·R`). Document the ~0.3 % regional error.
- Elevation is **above the Mars areoid**. Never mix MOLA areoid heights with
  ellipsoidal heights in one profile.
- Bilinear interpolation for elevation; slope from adjacent samples at the fixed
  spacing, not from pixel gradients (keeps drawn routes and synthetic tests on the
  same code path).
- Reject or mask `nodata` cells: a nodata sample becomes a `gap` flag, not a 0 m
  elevation (a fake cliff is worse than an honest gap).

### 4.4 Offline check

`npm run build` -> FastAPI serves `dist` + `/mars`. Demo must work with the network
adapter disabled. PMTiles and COG reads go through the local server only.

---

## 5. Compute engine

### 5.1 Sampling

1. Densify the polyline geodesically so consecutive samples are `spacing_m` apart
   (default 25 m, configurable in the UI later; the synthetic ramp test uses 30 m).
2. Sample the DEM bilinearly at each sample.
3. `ds` from the geodesic step; `dh = h[i] - h[i-1]`;
   `slope_i = atan2(dh, ds)` in degrees.
4. Emit `samples[]`, `segments[]`, `max_slope_deg`, `over_limit` (any segment),
   `climb_m = Σ max(dh, 0)`, `descent_m`, `distance_m`.

Optional smoothing of the elevation profile must be **off by default** and shown
as an assumption; it changes slope verdicts.

### 5.2 Motion and energy (profile-driven, no branching by explorer type)

Profiles live in TOML. The API serves their constants and citation rows to the UI;
the engine reads numbers only.

```
v_i    = v_max · clamp(1 - derate · max(slope_i,0)/slope_limit, v_min_frac, 1)
t_i    = ds / v_i
E_Wh   = P_base · Σt_i/3600 + (m · g · climb_m) / (η_drive · 3600)
```

- `g = 3.721 m/s²` (Mars).
- Human profile adds a second ledger: metabolic kcal
  (`P_metabolic · t + m·g·climb/η_body`), never merged with suit Wh.
- `checks[]`: slope (max vs limit), energy (Wh vs budget), duration (h vs budget).
  Verdict = all checks pass. The slope check also lists each failing segment with
  `over_by_deg` and its distance along the route.
- Round only at the presentation layer. Keep float64 in the engine.

### 5.3 Least-cost path

- Crop the DEM to the start/end bbox plus 1 km buffer; resample to a working grid
  of ~25 m, maximum 1200 × 1200 cells.
- 8-neighbour graph. Edge cost:
  `c = ds · (1 + k_slope · (|slope|/slope_limit)^2) · (1 + k_rough · roughness)`
  with `k_slope ≈ 6`. Edges above the profile's slope limit are removed; if no
  path exists, retry with a soft penalty and flag `limit_relaxed`.
- A* with Euclidean heuristic (admissible because `c ≥ ds`), `heapq`, numpy
  arrays. Cache the cropped grid per request; a 1 M-cell Dijkstra is sub-second.
- Return the path as lon/lat, then **run the same sampler** on it so the
  contingency card uses the same verdict code as a drawn route.
- Deterministic tie-breaking (stable neighbour order) so demos reproduce.

### 5.4 Tests

- **Synthetic ramp** (no rasterio): plane at exactly 10°, 30 m spacing, 120
  samples -> every slope 10° ± 0.01, distance 3570 m ± 1, climb 629.5 m ± 0.5,
  `over_limit` false at 20° limit; a 25° ramp flips it true.
- Bilinear sampler: flat plane, centre of four pixels, nodata propagation.
- Dijkstra: cone with one gentle azimuth -> path uses the saddle, not the crest;
  wall above limit -> blocked; no-path retry sets `limit_relaxed`.
- API: POST a 3-point route, assert schema keys and that `checks` is non-empty.
- Frontend: demo engine snapshot for the preset failing route (segment index and
  over-by value stable).

---

## 6. API contract

`GET /api/profiles` -> both profiles with every assumption and citation.
`POST /api/route`:

```json
{
  "region": "jezero",
  "profile": "rover",
  "spacing_m": 30,
  "coordinates": [[77.58, 18.44], [77.60, 18.45]]
}
```

Response (abridged):

```json
{
  "profile": "rover",
  "distance_m": 2183.4,
  "climb_m": 214.7,
  "descent_m": 31.2,
  "duration_s": 61200,
  "energy_wh": 1480.2,
  "max_slope_deg": 24.6,
  "slope_limit_deg": 20,
  "pass": false,
  "samples": [{ "distance_m": 0, "lon": 77.58, "lat": 18.44,
                "elevation_m": -2630.4, "slope_deg": 0,
                "over_limit": false }],
  "segments": [{ "index": 37, "start_m": 1110, "end_m": 1140,
                 "slope_deg": 24.6, "over_by_deg": 4.6,
                 "lon": 77.592, "lat": 18.446 }],
  "checks": [{ "id": "slope", "value": 24.6, "limit": 20, "unit": "deg",
               "pass": false, "detail": "Segment 37 exceeds limit by 4.6°" }],
  "assumptions": [{ "key": "mass_kg", "label": "Rover mass", "value": "1025",
                    "unit": "kg", "source": "NASA Perseverance fact sheet",
                    "source_url": "https://science.nasa.gov/mission/mars-2020-perseverance/" }],
  "contingency": { "available": true }
}
```

`POST /api/contingency` takes `{region, profile, start, end}` and returns a route
payload of the same shape plus `kind: "least_cost"`.

---

## 7. Frontend build

Framework choice: **Vite + React + TypeScript + MapLibre GL + pmtiles**, plain CSS
with tokens. No CDN fonts/assets; the app must render offline.

```
src/web/src/
├── App.tsx                 state: profile, points, result, contingency
├── components/
│   ├── MapView.tsx         MapLibre, PMTiles, graticule, draw interactions
│   ├── ElevationProfile.tsx responsive SVG, over-limit spans in red
│   ├── SurvivalCard.tsx    verdict + metrics + checks
│   ├── FailurePanel.tsx    segment, over-by, contingency action
│   ├── Assumptions.tsx     every constant + source link
│   └── Header.tsx          region, profile toggle, offline badge
├── lib/demoEngine.ts       synthetic terrain + same formulas (fallback)
├── lib/api.ts              POST /api/route, falls back to demo + badge
├── data/profiles.ts        display copy of rover.toml / human.toml
└── types.ts                the contract above
```

UX rules:

- Map is the hero; profile strip sits directly beneath it; card on the right.
- Over-limit chart spans use the same red as the map segment and failing row.
- PASS is teal, FAIL is rust-red; never colour-only (icon + text label).
- Assumptions table is open by default. Each row shows value, unit, source.
- Failed route: "Segment 37 · 1.11–1.14 km · 24.6° (limit 20°, +4.6°)", then a
  single primary action that draws the contingency in amber dashes.
- Empty state teaches the draw gesture in one line.
- Keyboard: Enter finish, Backspace undo vertex, Esc clear.
- Mobile: map 55vh, card below, profile 160px.

---

## 8. Phases, owners, exit criteria

| Phase | Work | Owner | Exit criterion |
|---|---|---|---|
| **0. Framework** | Vite app, layout, MapLibre, draw tool, demo engine, profile chart, survival card, assumptions table, Apache-2.0, plan doc | Afraz + Imran | `npm run dev` shows the full flow on synthetic data; build passes |
| **1. Data** | Acquire PMTiles + COG; write manifest, `docs/data.md`, `check_data.py`; verify CRS/nodata/bbox | Masum | App renders real Jezero basemap and a real elevation profile |
| **2. Engine** | `route.py`, `dem.py`, synthetic-ramp tests, profile TOMLs, `/api/route`, `/api/profiles` | Masum | Tests green; drawn route reproduces Phase 0 numbers within tolerance |
| **3. Wiring** | Replace demo fallback, wire API, loading/error states, spacing control, region manifest | Afraz | No demo badge; offline test passes |
| **4. Failure + LCP** | `graph.py` Dijkstra, cost tuning, contingency endpoint and UI, no-path fallback | Masum + Afraz | Failing preset names segment and offers a passing detour |
| **5. Survival polish** | Human dual ledger (Wh + kcal), duration/energy checks, presets, citations panel, a11y pass | Maksumul + Imran | Every number in the card traces to a source row |
| **6. Ship** | README, licence audit, Docker/one-command run, 240 s video, public repo check | Imran | Fresh clone -> running demo in < 10 min, airplane mode |

Parallelisation: Phase 1 and 2 can overlap; Phase 3 starts the moment
`/api/route` returns the contract shape. Phase 0's contract is frozen now.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| PMTiles export is huge or unavailable for Jezero | No basemap | Start with a z8–z12 crop, hard bbox; fall back to a low-zoom regional mosaic; keep the DEM as the source of truth |
| DEM lat convention / areoid mismatch | Wrong slopes, wrong verdicts | `check_data.py` asserts CRS, latitude type, nodata; cross-check two known points against Mars Trek elevations |
| DEM voids (stereo shadows) | Fake cliffs | Nodata mask + `gap` flag; UI warns instead of failing silently |
| A* too slow on full-res DEM | Frozen UI during contingency | Crop + downsample to 25 m + cell cap; time-box 2 s and return 422 with a clear message |
| Slope verdict sensitive to spacing | Demo inconsistency | Fix spacing (30 m), show it in assumptions, keep smoothing off |
| Constants not traceable | Judges discount the model | `docs/references.md` is a release gate; every UI assumption row links out |
| Windows/GDAL install pain | Team blocked | `rasterio` wheels on Python 3.13; otherwise `pip install rasterio` in a venv; COG stays local |
| Time | Missing contingency | Phase 4 is the only stretch-turned-required; if late, ship segment failure text without LCP and label it |

---

## 10. Immediate next actions

1. **Phase 0 — done:** `src/web`, demo engine, draw tool, profile chart, survival
   card, failure panel, assumptions table, plan and Apache-2.0 licence.
2. **Phase 2 — done:** `geo.py`, `route.py`, `graph.py`, `dem.py`, profile TOMLs,
   FastAPI endpoints, synthetic-ramp/graph/API tests. The frontend already talks
   to `/api/route` and falls back to the labelled demo when the DEM is missing.
3. **Phase 1 — next:** download the Jezero DEM + PMTiles, fill
   `cache/mars/manifest.json`, run `scripts/check_data.py`, and verify the
   planetocentric/areoid metadata against the source product.
4. Afraz: run the real-data route and contingency flows, then remove the demo
   badge from the recorded demo.
5. Maksumul: replace the remaining draft constants in `docs/references.md` with
   verified values and exact product IDs before Phase 5 closes.
