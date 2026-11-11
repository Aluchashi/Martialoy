# Martialoy status audit

**Audit date:** 2026-11-07 (Asia/Dhaka)  
**Scope:** Jezero Crater route planner; current checkout, local data, tests, build, local API, Vite proxy, and live deployment reachability.  
**Change policy:** No source code was changed, committed, or pushed during this audit. This report is the only file added by the audit. Existing local edits and untracked folders listed below were left untouched.

## Executive summary

- The route UI, dual explorer profiles, Python route/DEM/API code, slope and energy calculations, and Dijkstra contingency search are present.
- The cached Jezero PMTiles basemap and DEM are present. `python scripts/check_data.py` passed. The local API health response reports `dem_available: true`; the loader resolves the DEM to `cache/mars/jezero_dem.tif`. Both gentle and steep routes were then submitted to the running API for both profiles.
- The 5-point gentle route passed for Rover and Human. The 5-point steep route failed its slope limit for both. The real-DEM contingency endpoint found a passing, non-relaxed detour for each profile.
- Python tests: 11 passed, 4 skipped. The skipped API contract tests require `httpx2`, which is declared in `requirements-dev.txt` but is not installed. Installing it could not be completed because this environment could not resolve `pypi.org`.
- Frontend typecheck passed; production build passed with a large JavaScript chunk warning. No frontend test script is defined in `src/web/package.json`.
- The Vite dev server successfully proxied the local API and served the map manifest. The browser was not driven, so visual UI confirmation is **UNVERIFIED**; the client code and Vite proxy were checked instead.
- The live Vercel site and its assets could not be reached from this environment. Whether the live deployment has a production API endpoint is **UNVERIFIED**.

## 1. Orientation

### Git state

Commands:

```text
git status --short --branch
git branch --show-current
git diff --stat
git log -15 --oneline --decorate --date=short
```

Observed branch and status:

```text
## main...origin/main
 M src/web/src/App.tsx
 M src/web/src/components/Assumptions.tsx
 M src/web/src/components/MapView.tsx
 M src/web/src/styles.css
?? output/
?? tmp/
```

`main` is at `origin/main` with no ahead/behind count. The four modified frontend files and the untracked `output/` and `tmp/` folders were already present when this audit began. They were not changed by this audit. `docs/status_audit.md` is the only file added by this audit.

The repository contains seven commits, so `git log -15` returned these seven:

```text
b24f078 (HEAD -> main, origin/main, origin/HEAD) fix: publish Jezero basemap
1cc56a4 Map Page Updated
df75fd8 Gitignore updated
645effd (origin/feature/website-v2) Website v-2
0ad9dc6 Build Mars traverse planner framework
86d8a83 Enhance README with project details and structure
b4b7077 Initial commit
```

### Top-level repository structure

```text
cache/mars/             cached imagery, DEMs and manifests
docs/                   PLAN.md, data.md, references.md
scripts/                data preparation and validation
src/compute/             Python/FastAPI engine and profiles
src/web/                 React/Vite frontend
tests/                   Python unit and API contract tests
LICENSE
README.md
requirements.txt
requirements-dev.txt
```

The pre-existing untracked `output/` and `tmp/` folders are also in the checkout; they are not source directories.

### Tech stack and installed versions

Versions observed in this environment:

```text
Node.js v24.21.0
npm 11.19.0
Python 3.13.15
FastAPI 0.162.0
Uvicorn 0.54.0
Pydantic 2.14.2
NumPy 2.5.4
Rasterio 1.5.2
```

`npm.cmd --prefix src/web ls --depth=0` exited 0 and showed these installed frontend packages:

```text
@vitejs/plugin-react@6.1.2
maplibre-gl@6.15.0
pmtiles@4.5.0
react@19.3.1
react-dom@19.3.1
typescript@7.0.2
vite@8.3.4
```

The remaining installed top-level packages were `@types/geojson@7946.0.16`, `@types/node@26.6.5`, `@types/react@19.3.0`, and `@types/react-dom@19.3.0`.

The project uses React/TypeScript + Vite + MapLibre/PMTiles in the browser and FastAPI + NumPy + Rasterio on the Python side. `README.md`, `docs/PLAN.md`, `docs/data.md`, and `docs/references.md` were read for this audit.

### Documentation drift found

The checked-in documentation describes an older cache state:

- `README.md` says the local PMTiles and regional COG are “Not cached in this checkout.”
- `docs/PLAN.md` says Phase 1 data is pending and its immediate next actions say to download the DEM and PMTiles.
- `docs/data.md` says the basemap is still missing.

Those statements conflict with the current cache and validation output below. Current data-check evidence takes precedence for this audit.

## 2. Local execution and verification

### Dependencies and tests

Frontend dependencies were already installed and `npm ls --depth=0` succeeded. The frontend scripts are `dev`, `build`, `preview`, and `typecheck`; there is no `test` script, so no JavaScript unit-test suite is defined in the package manifest.

The final Python test run used a writable temp directory because the default sandbox temp path prevented Rasterio from creating its two temporary GeoTIFFs. Command:

```powershell
$env:TEMP = (Resolve-Path 'tmp\pdfs').Path
$env:TMP = $env:TEMP
python -m unittest discover -s tests -v
```

Result:

```text
Ran 15 tests in 0.352s

OK (skipped=4)
```

That is 11 passed, 0 failed, 4 skipped. The four skipped tests are `test_health_and_profiles`, `test_route_contract_with_flat_dem`, `test_contingency_contract_with_flat_dem`, and `test_unknown_profile_rejected`. `tests/test_api.py` skips them unless both FastAPI and `httpx2` can be imported. FastAPI is installed; `httpx2` is not.

The audit attempted to install the missing declared test dependency:

```text
python -m pip install "httpx2>=0.1"
```

It did not install because package-index DNS/network access failed:

```text
NameResolutionError: Failed to resolve 'pypi.org' ([Errno 11001] getaddrinfo failed)
ERROR: No matching distribution found for httpx2>=0.1
```

The “no matching distribution” line followed the network failure; package availability could not be independently established.

The first Python test attempt, before setting `TEMP` and `TMP`, had 2 Rasterio errors because it tried to create `plane.tif` and `gap.tif` under a sandbox-managed temp path and received `Permission denied`. Re-running with a project-writable temp directory passed both tests; the final count above is from that successful run.

Frontend typecheck command and result:

```text
> npm.cmd --prefix src/web run typecheck
> tsc --noEmit
exit code: 0
```

### Data validation

Command:

```text
python scripts/check_data.py
```

Full output:

```text
OK    manifest parsed: F:\Programming\Project\Martialoy\cache\mars\manifest.json
OK    bbox 76.99743706146..78.58293305797 E, 17.58050480819..19.29018700687 N; center inside
OK    PMTiles magic valid (12.3 MB)
OK    DEM opens: 4457 x 5067 px, 1 band(s)
OK    DEM CRS is geographic: ESRI:104971
OK    latitude_type: planetocentric
OK    nodata matches manifest: -32768.0
OK    resolution approximately 21.0 m/px

Cache is ready for the local route engine.
```

Current inputs found:

- `cache/mars/basemap.pmtiles` (12,949,767 bytes). Manifest attribution: USGS Astrogeology Science Center / NASA MRO CTX.
- `cache/mars/jezero_dem.tif` (46,918,125 bytes), selected by `cache/mars/manifest.json`. The data documentation identifies the prepared source as the USGS Mars 2020 Science Investigation CTX DEM Mosaic; manifest tags it planetocentric and Mars-areoid/MOLA controlled.
- `src/web/public/mars/manifest.json` and `basemap.pmtiles` are tracked. The production build copied both into `src/web/dist/mars/`; file sizes and SHA-256 hashes matched between public and dist copies.
- A 36,269,402-byte `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif` and source DEM archives are also in the cache, but the frontend manifest names `basemap.pmtiles` and the backend manifest names `jezero_dem.tif` as the active inputs.

### Production frontend build

Command:

```text
npm.cmd --prefix src/web run build
```

Result: exit code 0; TypeScript and Vite production build passed. Output:

```text
vite v8.3.4 building client environment for production...
✓ 36 modules transformed.
dist/index.html                                 1.09 kB │ gzip:   0.61 kB
dist/assets/maplibre-gl-worker-UMzBwfZH.js    518.49 kB
dist/assets/index-B4OrPBiU.css                106.25 kB │ gzip:  18.05 kB
dist/assets/index-BHMyQIUA.js               1,360.82 kB │ gzip: 382.57 kB │ map: 3,601.99 kB
✓ built in 3.58s
(!) Some chunks are larger than 500 kB after minification.
```

The warning is not a build failure. The main JavaScript bundle is 1,360.82 kB before gzip and 382.57 kB gzip; Vite recommends code splitting.

### Local API and real-DEM proof

Server command:

```text
python -m uvicorn src.compute.api:app --host 127.0.0.1 --port 8000
```

Observed startup:

```text
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Health request and exact JSON:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health | ConvertTo-Json -Depth 5
```

```json
{
  "status": "ok",
  "region": "jezero",
  "label": "Jezero Crater",
  "dem_available": true,
  "profiles": ["rover", "human"],
  "warning": null
}
```

The running API is configured to use the real COG, not the synthetic frontend fallback:

1. Runtime loader check printed `loader_path=F:\Programming\Project\Martialoy\cache\mars\jezero_dem.tif`, `width=4457 height=5067 crs=ESRI:104971 nodata=-32768.0`, and a finite sample `sample_77.55_18.45=-2635.8536653488245`.
2. `src/compute/api.py` calls `load_region_dem()` for `/api/route` and passes `dem.sample` to `build_route_result()`.
3. `src/compute/dem.py` resolves `manifest.dem_file` and constructs `DemRaster`; `DemRaster` opens the path with `rasterio.open()`.
4. The API health response reports `dem_available: true`, and API request logs show successful `POST /api/route` and `POST /api/contingency` responses.

### Route requests

Two fixed, 5-point Jezero routes were sent to `POST /api/route` for **both** Rover and Human, with `region=jezero` and `spacing_m=25`. Coordinates are `[longitude, latitude]`.

Gentle route:

```json
[[77.550000,18.450000],[77.552000,18.450500],[77.554000,18.451000],[77.556000,18.451500],[77.558000,18.452000]]
```

API outputs (rounded slopes below are the audit command's presentation rounding to 2 decimals; other metrics retain the returned values):

```json
{
  "route":"gentle",
  "sample_slope_deg":[0.0,2.44,2.25,1.18,-0.39,-1.4,-1.06,-0.11,0.87,1.57,1.49,0.77,0.32,0.22,0.26,0.6,0.86,0.87,0.67],
  "rover":{"distance_m":464.2644422873027,"climb_m":6.458070261294779,"descent_m":1.3284944031393024,"duration_s":11306.339794844323,"energy_wh":360.67596374884494,"energy_secondary":null,"max_slope_deg":2.4375081765468263,"slope_limit_deg":20.0,"pass":true,"failing_segments":[],"warnings":[]},
  "human":{"distance_m":464.2644422873027,"climb_m":6.458070261294779,"descent_m":1.3284944031393024,"duration_s":526.0745825913248,"energy_wh":19.953289392487438,"energy_secondary":{"label":"Metabolic","value_kcal":42.31520801391844},"max_slope_deg":2.4375081765468263,"slope_limit_deg":25.0,"pass":true,"failing_segments":[],"warnings":[]}
}
```

Steep route:

```json
[[77.356000,18.306116],[77.358000,18.306116],[77.360000,18.306116],[77.361173,18.306116],[77.362951,18.306116]]
```

API outputs:

```json
{
  "route":"steep",
  "sample_slope_deg":[0.0,-4.57,-5.62,-6.98,-8.28,-9.75,-12.19,-14.72,-17.4,-20.4,-19.21,-18.18,-26.82,-31.34,-31.02,-29.11],
  "rover":{"distance_m":390.3964337376875,"climb_m":0.0,"descent_m":123.14598010179361,"duration_s":9295.153184230658,"energy_wh":284.018569518159,"max_slope_deg":31.343799870780945,"slope_limit_deg":20.0,"pass":false,"failure_reason":"5 segments over limit · worst +11.3° at 0.31 km","failing_segments":[{"index":9,"start_m":208.21143132676667,"end_m":234.2378602426125,"slope_deg":-20.4,"over_by_deg":0.4},{"index":12,"start_m":286.29071807430415,"end_m":312.31714699015004,"slope_deg":-26.82,"over_by_deg":6.82},{"index":13,"start_m":312.31714699015004,"end_m":338.34357590599586,"slope_deg":-31.34,"over_by_deg":11.34},{"index":14,"start_m":338.34357590599586,"end_m":364.3700048218417,"slope_deg":-31.02,"over_by_deg":11.02},{"index":15,"start_m":364.3700048218417,"end_m":390.3964337376875,"slope_deg":-29.11,"over_by_deg":9.11}],"warnings":[]},
  "human":{"distance_m":390.3964337376875,"climb_m":0.0,"descent_m":123.14598010179361,"duration_s":433.7738152640974,"energy_wh":12.049272646224928,"energy_secondary":{"label":"Metabolic","value_kcal":31.102341658612495},"max_slope_deg":31.343799870780945,"slope_limit_deg":25.0,"pass":false,"failure_reason":"4 segments over limit · worst +6.3° at 0.31 km","failing_segments":[{"index":12,"start_m":286.29071807430415,"end_m":312.31714699015004,"slope_deg":-26.82,"over_by_deg":1.82},{"index":13,"start_m":312.31714699015004,"end_m":338.34357590599586,"slope_deg":-31.34,"over_by_deg":6.34},{"index":14,"start_m":338.34357590599586,"end_m":364.3700048218417,"slope_deg":-31.02,"over_by_deg":6.02},{"index":15,"start_m":364.3700048218417,"end_m":390.3964337376875,"slope_deg":-29.11,"over_by_deg":4.11}],"warnings":[]}
}
```

The steep path goes downhill over the sharpest part of the selected DEM section: positive climb is 0 m and descent is about 123.15 m. Both profiles fail only the slope check; energy and duration checks pass on the direct route.

### Least-cost contingency

The same steep route's start and end were submitted to `POST /api/contingency` for both profiles. The backend returned paths, re-evaluated each through the route engine, and reported `relaxed=false`.

```json
{
  "rover":{"found":true,"coordinate_count":27,"relaxed":false,"cells":7857,"resolution_m":25.0,"distance_m":755.3337317183768,"climb_m":0.0,"duration_s":17984.13646948516,"energy_wh":549.5152810120467,"max_slope_deg":15.346384477681317,"slope_limit_deg":20.0,"pass":true,"warnings":[]},
  "human":{"found":true,"coordinate_count":24,"relaxed":false,"cells":7857,"resolution_m":25.0,"distance_m":669.9781122554251,"climb_m":0.0,"duration_s":744.42012472825,"energy_wh":20.678336798006942,"energy_secondary":{"label":"Metabolic","value_kcal":53.376225678233794},"max_slope_deg":14.924497060121137,"slope_limit_deg":25.0,"pass":true,"warnings":[]}
}
```

Both detours pass slope, energy, and duration checks. No warnings were returned.

### Frontend-to-API verification

No browser screenshot/interaction was performed, so rendered UI behavior is **UNVERIFIED**. The frontend client code was inspected:

- `src/web/src/lib/api.ts` probes `/api/health`, posts route requests to `/api/route`, returns `engine: 'api'` on a successful API response, and otherwise falls back to the synthetic `demoEngine`.
- `src/web/src/App.tsx` stores the returned result and engine using `setResult(response.result)` and `setEngine(response.engine)`.
- `src/web/vite.config.ts` proxies `/api` to `MARTIALOY_API` or `http://127.0.0.1:8000` during development.

The frontend was run at `http://127.0.0.1:5173/`; requests through the Vite server returned:

```json
{
  "proxy_health":{"status":"ok","region":"jezero","label":"Jezero Crater","dem_available":true,"profiles":["rover","human"],"warning":null},
  "manifest_region":"jezero",
  "basemap_file":"basemap.pmtiles",
  "route_profile":"rover",
  "route_distance_m":464.2644422873027,
  "max_slope_deg":2.4375081765468263,
  "pass":true
}
```

This verifies the Vite proxy and API response path, not the rendered browser UI.

## 3. Live deployment check

Live fetch was attempted with the web fetch tool and with `curl.exe` for the page, `/api/health`, and `/mars/manifest.json`. The web fetch tool reported the URLs were not accessible. Command-line network attempts returned:

```text
curl: (6) Could not resolve host: martialoy.vercel.app
```

The escalated read-only attempt timed out on all three URLs:

```text
curl: (28) Connection timed out after 20004 milliseconds
```

Therefore live page contents, deployed asset availability, and whether the live deployment has a production API endpoint are **UNVERIFIED**. The local source config has `VITE_API_BASE` default to an empty string and a Vite dev-only proxy; no tracked `vercel.json` or Vercel serverless API file was found. This is not proof of the Vercel dashboard's environment variables or rewrite settings.

## 4. Completion assessment

| Area | Verified status | Evidence / remaining gap |
|---|---|---|
| Route drawing, explorer switch, profile chart, survival/failure UI | Code present | Frontend build/typecheck pass; browser visual behavior not checked in this audit. |
| Rover/Human route engine | Locally working | Both profiles returned correct-shaped real-DEM API responses for two five-point routes. |
| COG data | Ready locally | Checker passed; runtime loader path is the cached `jezero_dem.tif`. |
| PMTiles basemap | Ready locally and included in local production build | Checker passed; public/dist manifests and PMTiles hashes match. Live Vercel fetch unavailable. |
| Slope, time, energy, pass/fail | Locally working | Gentle routes pass; steep routes fail on slope as expected; both ledgers reported separately. |
| Dijkstra contingency | Locally working | Both real-DEM detours returned `relaxed=false`, pass verdicts, no warnings. |
| Python test suite | Partial | 11 pass; 4 API tests skipped because `httpx2` is missing and PyPI was unreachable. |
| Frontend unit tests | Not configured | No `test` script in `src/web/package.json`; typecheck and production build pass. |
| Live API and deployment | **UNVERIFIED** | Public host could not be reached from this environment; Vercel settings unavailable. |
| Roughness, soft-ground, return/exposure hazards | Not present in current route response/UI code inspected | Add and validate if required by the final challenge scope, or document as excluded. |
| Science-interest layer and real rover traverse validation | **UNVERIFIED / not implemented in inspected MVP code** | HiRISE/CRISM are listed as data possibilities, but no active layer or validation result was found in the running route flow. |
| Offline end-to-end run and user usability review | **UNVERIFIED** | Not performed in this audit. |

## 5. Next actions

1. Add/install the missing `httpx2` test dependency when package access is available, then rerun the 4 skipped API contract tests. Review whether `httpx2` is intentional in `requirements-dev.txt`.
2. Configure and verify the production API host/rewrite for Vercel; confirm the live health endpoint and one Rover + one Human request.
3. Drive the browser against local and live environments to visually confirm the basemap, API engine badge, route card, and contingency interaction.
4. Update `README.md`, `docs/PLAN.md`, and `docs/data.md` to reflect the cache state now present; record the exact basemap product, download/export details, and DEM audit trail.
5. Decide which planned hazards/science features are in final scope. Implement/validate the required ones or explicitly mark them out of scope.
6. Compare the model against at least one real rover traverse and record expected vs computed measurements before describing the result as validated.
7. Run an offline end-to-end demo and record evidence for the final submission.

