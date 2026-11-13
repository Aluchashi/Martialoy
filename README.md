# Martialoy

**A dual-profile traverse and survival planner for Mars.**

Plan a traverse across Jezero Crater for a Perseverance-class rover or a suited
explorer. Martialoy samples terrain elevation along the route, estimates slope,
time and energy, reports pass/fail checks, and can search for a lower-cost
contingency route.

> NASA Space Apps Challenge 2026, Bangladesh edition  
> Theme: *The Next Frontier*  
> Challenge: *Interplanetary Survival Guide: Martian Map*

---

## Status

| Layer | State |
|---|---|
| Landing page and three-step route workflow | **Working** |
| MapLibre map, local CTX basemap, route drawing and examples | **Working** |
| Real Jezero DEM and FastAPI route engine | **Available in this checkout** |
| Rover and suited-explorer profiles, assumptions and survival checks | **Working** |
| Least-cost contingency route | **Available through the local API** |
| Demo engine | **Fallback when the API or DEM is unavailable** |

The checkout includes the Jezero DEM, PMTiles basemap, and manifests under
`cache/mars/`. The API uses the local DEM when it is running. Without the API,
the web client falls back to its clearly labelled synthetic demo engine.

## What it does

The app guides the user through three screens:

1. **Select a route.** Choose Rover or Human, load an example route, or draw a
   route on the Jezero map. Finish the route to continue.
2. **Review calculations.** See distance, elevation gain, slope, travel time,
   and the separate energy estimates.
3. **Check the journey.** Review pass/fail checks, the limiting route segment,
   and a contingency route when the API finds one.

- **Shared calculation engine.** Rover and Human profiles use the same route
  physics with different profile values stored in TOML.
- **Separate human energy ledgers.** Suit electrical energy (Wh) and estimated
  metabolic effort (kcal) are reported separately.
- **Visible assumptions.** The UI shows the values, units, and sources used by
  each profile. Engineering estimates are labelled as estimates.
- **Local map data.** The map and DEM are served from the project checkout; map
  tiles and elevation data are not fetched from a remote tile service at runtime.
- **Contingency search.** When requested, the API uses Dijkstra search over a
  terrain grid, then evaluates the resulting route with the same route engine.

## Quick start (web UI with demo fallback)

Requires Node.js 20+.

```powershell
cd src/web
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The app can use its demo engine if the local API is
not running. From the route screen, try the **Failing example** and **Safe
example** buttons, or draw a route on the map and select **Finish route**.

Build the web client:

```powershell
cd src/web
npm run build
```

## Full local stack (real Jezero terrain)

The current checkout includes the local map and terrain files. First install
and run the Python API in one terminal from the repository root:

```powershell
# Run from the repository root.
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.compute.api:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, start the web client:

```powershell
# In a second terminal, from the repository root:
cd src/web
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to the local FastAPI service
and serves the data in `cache/mars/` under `/mars`.

To serve the production build and API from one process:

```powershell
# From the repository root:
cd src/web
npm run build
cd ..\..
.venv\Scripts\activate
uvicorn src.compute.api:app --host 127.0.0.1 --port 8000
```

Then open <http://127.0.0.1:8000>. FastAPI serves the built web client and the
local Mars files.

## Local Mars data

| Layer | Product used | Source |
|---|---|---|
| Basemap | Jezero CTX orthorectified image mosaic, 6 m/pixel (`JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif`, exported to `basemap.pmtiles`) | [USGS Astrogeology Science Center](https://astrogeology.usgs.gov/search/map/Mars/Mars2020/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0); NASA MRO Context Camera (CTX) |
| Elevation | Mars 2020 Jezero CTX DEM mosaic, 20 m/pixel (`M20_JezeroCrater_CTXDEM_20m.tif`, prepared as `jezero_dem.tif`) | [USGS Astrogeology Science Center](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic) |

The basemap covers part of Jezero, not the whole crater. Its current footprint is
approximately 77.1605–77.6992°E and 18.2110–18.7212°N. The DEM covers a larger
area and is used for route elevation and slope calculations. Both files and the
active manifests are in `cache/mars/`; see [`docs/data.md`](docs/data.md) for
processing notes and [`docs/references.md`](docs/references.md) for citations
and model assumptions.

Validate the local data configuration with:

```powershell
python scripts/check_data.py
```

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Engine status, region and DEM availability |
| `GET` | `/api/profiles` | Rover and Human profile constants and citations |
| `POST` | `/api/route` | Evaluate a drawn route and return the result |
| `POST` | `/api/contingency` | Search for and evaluate a least-cost route |

Example route request:

```json
{
  "region": "jezero",
  "profile": "rover",
  "spacing_m": 25,
  "mode": "drawn",
  "coordinates": [[77.58, 18.44], [77.62, 18.44]]
}
```

Coordinates are `[longitude, latitude]` using Mars planetocentric latitude and
east longitude. The response contract is documented in
[`docs/PLAN.md`](docs/PLAN.md) and [`src/web/src/types.ts`](src/web/src/types.ts).

## Model

```text
ds_i    = distance between adjacent samples
 dh_i   = h_i - h_(i-1)
slope_i = atan2(dh_i, ds_i)

v_i     = v_max * clamp(1 - derate * max(slope_i, 0) / slope_limit,
                        min_speed_fraction, 1)
t_i     = ds_i / v_i

E_Wh    = P_base * sum(t_i)/3600
          + (m * g * climb_m) / (eta_drive * 3600)

E_kcal  = (P_metabolic * sum(t_i)/3600
           + (m * g * climb_m) / eta_body) * 0.860421 / 3600
```

- Mars radius and gravity are documented in [`docs/references.md`](docs/references.md).
- Route spacing is profile-configurable (25 m by default); smoothing is off by
  default.
- `climb_m` counts positive elevation change only; descents do not recover energy.
- DEM nodata is never treated as zero elevation. The engine warns rather than
  inferring a slope across a data gap.
- The model is a planning aid. Values such as drivetrain efficiency, speed
  derating, and human metabolic rate include engineering estimates.

## Least-cost contingency

The API crops the DEM around the route endpoints with a 1 km buffer, resamples it
to a working grid, then searches eight-connected neighbours using Dijkstra's
algorithm:

```text
cost = ds * (1 + 6 * (|slope| / slope_limit)^2)
```

Edges above the profile slope limit are excluded first. If no path exists, the
search retries with those edges allowed and flags the result as relaxed. The
returned path is evaluated by the same route engine used for a drawn route.

## Tests

```powershell
python -m unittest discover -s tests -v
npm --prefix src/web run typecheck
```

The suite covers route calculations, DEM sampling and nodata, Dijkstra
contingency behavior, and API response contracts. Install
`requirements-dev.txt` for the Python test dependencies.

## Repository layout

```text
.
├── README.md
├── requirements.txt              Python API and raster dependencies
├── cache/mars/                   Local DEM, CTX mosaic, PMTiles and manifests
├── docs/
│   ├── PLAN.md                   Architecture and API contracts
│   ├── data.md                   Data processing notes
│   ├── references.md             Model values and sources
│   └── status_audit.md           Local project audit
├── scripts/
│   ├── check_data.py             Validate the local Mars data configuration
│   └── prepare_dem.py            Prepare the DEM for the route engine
├── src/
│   ├── compute/                  FastAPI, route engine, DEM and graph search
│   └── web/                      React, TypeScript, Vite and MapLibre client
└── tests/                        Python route, graph, DEM and API tests
```

## Data attribution

The local basemap and elevation mosaic are products of the USGS Astrogeology
Science Center using Mars Reconnaissance Orbiter Context Camera (CTX) data.
Credit USGS Astrogeology Science Center and NASA/JPL. Individual products have
their own usage and citation terms; consult the linked product pages before
redistributing derived files.

Model constants and mission references are listed in
[`docs/references.md`](docs/references.md). Estimates are identified there and
in the app, and should not be presented as measured mission specifications.

## Limitations

This is a hackathon planning model, **not mission-grade or medical advice**. It
does not model wheel slip, sand traps, thermal duty cycles, battery charge
curves, radiation, communication windows, weather, or human physiology beyond a
constant metabolic rate. Slope verdicts depend on route sampling spacing, which
is shown in the UI and result.

## Use of AI

Required by the Space Apps rules. Record the tools used by the team in this
table before submission.

| Tool | Used for | Notes |
|---|---|---|
| OpenCode + DeepSeek | UI scaffold, compute engine, tests and documentation | Generated code was reviewed by the team; published NASA values were checked against linked sources where possible. Engineering estimates remain labelled. |

## Team

| Member | Role | Responsibility |
|---|---|---|
| Md. Imran Hasan | Team Lead | Architecture, Git workflow and code review, integration, deadlines and final pitch |
| Afrazur Rahman | Technical | Map interface, route drawing, hazard overlay, survival card and offline deployment |
| Md. Masum Parvej | Data Engine | DEM processing, slope, segmentation, energy model and explorer profiles |
| Maksumul Haque | Science and Research | Reference constants, citations, documentation, project page and videos |

## License

[Apache License 2.0](LICENSE). You may use, modify and distribute the code with
attribution. NASA and USGS data remain subject to their product-specific terms.

## Acknowledgements

Built for the NASA International Space Apps Challenge 2026. We acknowledge the
USGS Astrogeology Science Center, NASA/JPL, the Mars Reconnaissance Orbiter CTX
team, and the open-source software projects used to build Martialoy.
