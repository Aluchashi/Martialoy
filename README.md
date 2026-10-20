# Martialoy

**A dual-profile traverse and survival planner for Mars.**

Draw a route on Mars, choose a rover or a suited astronaut, and get a verdict:
distance, climb, traverse time, energy, maximum slope, pass/fail, and the exact
segment that breaks the limit. If the route fails, Martialoy searches the DEM for
a least-cost contingency path.

> NASA Space Apps Challenge 2026, Bangladesh edition  
> Theme: *The Next Frontier*  
> Challenge: *Interplanetary Survival Guide: Martian Map*

---

## Status

| Layer | State |
|---|---|
| Web UI (MapLibre, draw tool, elevation profile, survival card, assumptions) | **Working** |
| Demo engine (synthetic Jezero-like terrain, full verdict + Dijkstra) | **Working** |
| Python compute engine (`route.py`, `graph.py`, `dem.py`, FastAPI) | **Working, unit-tested** |
| Local PMTiles basemap + regional COG DEM | **Not cached in this checkout** |
| Real-data end-to-end run | Waiting on `cache/mars/` payloads |

The UI is honest about this: the header shows **Demo terrain** until a real COG
is connected. The frontend falls back to the demo engine when the API is absent
or the DEM is not cached, instead of showing a dead screen.

## What it does

```
choose Human or Rover
        |
draw a polyline on the local basemap
        |
sample the DEM every 25 m -> slope profile -> time + energy -> verdict
        |
survival card: distance, time, energy, max slope, PASS/FAIL, all assumptions
        |
on FAIL: name the failing segment and overage, offer a least-cost detour
```

- **Same engine, two profiles.** There is no `if human` branch in the physics.
  A profile is a set of constants in TOML: mass, speed, power, efficiency, slope
  limit, energy budget, duration budget and derate.
- **Two human ledgers.** Suit electrical energy (Wh) and metabolic effort (kcal)
  are reported separately and never added together.
- **Every assumption on screen.** The model table shows value, unit and source
  for each constant. Nothing important is buried in code.
- **Offline by design.** Basemap tiles and the DEM are local files. The app does
  not call a tile server or terrain API at runtime.

## Quick start (UI only, demo terrain)

Requires Node.js 20+.

```bash
cd src/web
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. In the empty survival card, choose:

- **Try a failing traverse** — rover exceeds 20° on the crater rim.
- **Try a safe traverse** — short basin route that passes both profiles.

The failing preset is a 2.24 km direct traverse with a 24.7° maximum slope. The
contingency search returns a 3.26 km detour with a 16.7° maximum slope and a PASS
verdict on the demo terrain.

Production build:

```bash
cd src/web
npm run build
```

## Full local stack (real DEM)

### 1. Cache the Mars data

The repository does not ship the basemap or DEM. Follow
[`docs/data.md`](docs/data.md) and [`cache/mars/README.md`](cache/mars/README.md):

```powershell
Copy-Item cache/mars/manifest.example.json cache/mars/manifest.json
# put basemap.pmtiles and jezero_dem.tif in cache/mars/
python scripts/check_data.py
```

`check_data.py` validates the PMTiles magic bytes, bbox, CRS, latitude
convention, nodata and resolution. It refuses a planetographic DEM, because that
would silently shift routes and corrupt slope verdicts.

### 2. Install the Python engine

Requires Python 3.11+ (the profile loader uses `tomllib`).

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

`rasterio` is only needed for the COG adapter and the data checker. The pure
route/graph tests run on a bare Python install.

### 3. Run the API

```bash
uvicorn src.compute.api:app --reload --host 127.0.0.1 --port 8000
```

Or serve the built web app and the API from one process:

```bash
cd src/web && npm run build && cd ../..
uvicorn src.compute.api:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. FastAPI mounts `src/web/dist` at `/` and
`cache/mars` at `/mars`. When the Vite dev server is running, it proxies `/api`
and `/mars` to port 8000.

### 4. Verify offline

Build the app, start FastAPI, disable the network adapter, reload. The basemap
should render and the header should read **Local DEM**, not **Demo terrain**.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Engine status, region, cached-DEM availability |
| `GET` | `/api/profiles` | Rover and human constants, formula and full citation table |
| `POST` | `/api/route` | Sample a drawn polyline and return the verdict payload |
| `POST` | `/api/contingency` | Least-cost path between start and end, then the same verdict code |

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

The full response contract is in [`docs/PLAN.md`](docs/PLAN.md) section 6 and
[`src/web/src/types.ts`](src/web/src/types.ts).

## Model

```
ds_i    = distance between adjacent samples
dh_i    = h_i - h_(i-1)
slope_i = atan2(dh_i, ds_i)

v_i     = v_max * clamp(1 - derate * max(slope_i, 0) / slope_limit,
                        min_speed_fraction, 1)
t_i     = ds_i / v_i

E_Wh    = P_base * sum(t_i)/3600
          + (m * g * climb_m) / (eta_drive * 3600)

E_kcal  = (P_metabolic * sum(t_i)/3600
           + (m * g * climb_m) / (eta_body * 3600)) * 0.860421
```

- Mars is a sphere of radius **3,389,500 m**.
- Gravity is **3.721 m/s²**.
- Sampling spacing is fixed (25 m by default), and smoothing is off by default.
- `climb_m` counts positive elevation change only; descents are not recovered.
- Slope is computed from adjacent route samples, not from pixel gradients, so a
  synthetic ramp and a real drawn route follow the same code path.
- DEM nodata is never treated as zero elevation. A gap produces a warning and no
  slope is inferred across it.

Every constant, source and limitation is documented in
[`docs/references.md`](docs/references.md). Values marked **engineering estimate**
are modelling choices, not mission specifications.

## Least-cost contingency

If the drawn route fails, the engine crops the DEM around the start/end bbox plus
a 1 km buffer, resamples to a working grid, and runs Dijkstra over 8 neighbours:

```
cost = ds * (1 + 6 * (|slope| / slope_limit)^2)
```

Edges above the profile slope limit are removed. If no path exists, the search is
retried with those edges allowed and the response is flagged `relaxed`, so the UI
can warn instead of pretending the route is safe. The resulting polyline is
re-sampled by the same route code as a hand-drawn line.

## Tests

```bash
python -m unittest discover -s tests -v
npm --prefix src/web run typecheck
```

Current coverage:

- **Synthetic 10° ramp** at 30 m spacing: every slope 10° ± 0.01, distance
  3,570 m, climb 629.5 m, slope check passes.
- **25° ramp**: rover slope check fails, with a known +5.0° overage.
- **Nodata propagation**: no fabricated slope or climb across a gap.
- **Human ledger**: metabolic kcal ledger present and separate from suit Wh.
- **Bilinear COG sampler**: pixel centres, interpolation midpoint, edge pixels and
  nodata propagation.
- **Dijkstra wall**: path uses the northern gap when the wall is blocked.
- **No-gap wall**: relaxed retry is flagged instead of returning a fake pass.
- **API contract**: health, profiles, route payload keys, contingency payload,
  unknown-profile 422.

API tests are skipped automatically when FastAPI is not installed; install
`requirements-dev.txt` to run them.

## Repository layout

```
.
├── LICENSE                     Apache-2.0
├── README.md
├── requirements.txt            fastapi, uvicorn, pydantic, numpy, rasterio
├── cache/mars/                 local payloads (git-ignored) + manifest example
│   ├── README.md
│   └── manifest.example.json
├── docs/
│   ├── PLAN.md                 architecture, contracts, phases, risks
│   ├── data.md                 data pipeline and audit trail
│   └── references.md           every constant -> source
├── scripts/check_data.py       validates manifest, bbox, CRS, nodata, PMTiles
├── src/
│   ├── compute/
│   │   ├── api.py              FastAPI app
│   │   ├── dem.py              COG adapter (lazy rasterio)
│   │   ├── geo.py              spherical geometry + fixed-spacing sampler
│   │   ├── graph.py            Dijkstra least-cost path
│   │   ├── route.py            slope, motion, energy, verdict
│   │   └── profiles/           rover.toml, human.toml
│   └── web/                    Vite + React + TypeScript + MapLibre + PMTiles
└── tests/
    ├── test_route.py
    ├── test_graph.py
    └── test_api.py
```

## Data and attribution

| Data | Use | Source |
|---|---|---|
| Regional basemap | Visual context, offline tiles | [NASA Mars Trek](https://trek.nasa.gov/mars/) |
| DEM | Elevation, slope, least-cost path | [NASA Planetary Data System](https://pds.nasa.gov/) |
| Imagery (stretch) | Roughness context | HiRISE / PDS |
| Mineral maps (stretch) | Science layer | CRISM / PDS |
| Rover specifications | Rover profile | NASA Mars 2020 mission pages |
| Spacesuit / metabolic references | Human profile | NASA human spaceflight references |

NASA data are generally public domain, but each product has its own citation and
redistribution terms. Check the product page before committing a derived export.
The app footer credits NASA Mars Trek and PDS.

## Limitations

This is a hackathon planning model, **not mission-grade or medical advice**. It
does not model wheel slip, sand traps, thermal duty cycles, battery charge curves,
radiation, communication windows, weather, or human physiology beyond a constant
metabolic rate. Slope verdicts depend on sample spacing; spacing is shown in the
UI and in every result. See `docs/references.md` for the full list.

## Use of AI

Required by the Space Apps rules. This table will be updated as work continues.

| Tool | Used for | Notes |
|---|---|---|
| OpenCode + DeepSeek | UI scaffold, compute-engine implementation, tests, documentation | All generated code reviewed and tested by the team; NASA values verified against the linked sources where possible. Draft engineering estimates remain explicitly labelled. |

## Team

| Member | Role | Responsibility |
|---|---|---|
| Md. Imran Hasan | Team Lead | Architecture, Git workflow and code review, integration testing, deadlines, final pitch |
| Afrazur Rahman | Technical | Map interface, route drawing, hazard overlay, survival card, offline deployment, GitHub repo |
| Md. Masum Parvej | Data Engine | DEM processing, slope, segmentation, energy model, explorer profiles |
| Maksumul Haque | Science and Research | Reference constants and citations, documentation, project page, videos |

## License

[Apache License 2.0](LICENSE). You may use, modify and distribute the code with
attribution. NASA data remain subject to their own terms.

## Acknowledgements

Data and mission information from NASA and its open data programs (Mars Trek,
HiRISE, CRISM, Planetary Data System). Built for the NASA International Space
Apps Challenge 2026.
