# Martian Map: Project Structure

Dual-profile (human / rover) route planner on real Mars terrain.
NASA Space Apps 2026, Challenge 11 (Interplanetary Survival Guide: Martian Map).
Default region: Jezero Crater.

Agents: read `AGENTS.md` first. Read `docs/contract.md` before touching any interface.

## Folder tree

```
martian-map/
|-- AGENTS.md                  # rules for any coding agent (single source of truth)
|-- CLAUDE.md                  # imports AGENTS.md + Claude Code notes
|-- README.md
|-- LICENSE                    # Apache-2.0
|-- Makefile                   # setup | test | lint | run
|-- pyproject.toml             # ruff + pytest config
|-- requirements.txt
|-- .env.example               # EDL_USER, EDL_PASS, NASA_API_KEY, OFFLINE
|-- .gitignore                 # cache/ is ignored
|
|-- .claude/skills/
|   |-- compute-change/SKILL.md    # test-first workflow for src/compute
|   `-- log-data-source/SKILL.md   # how to log data and constants with sources
|-- .github/pull_request_template.md
|
|-- profiles/                  # explorer profiles: DATA, not code
|   |-- rover_perseverance.json    # one ledger: electrical (Wh)
|   `-- human_eva.json             # two ledgers: electrical (Wh), metabolic (kcal)
|
|-- src/
|   |-- acquire/               # network allowed ONLY here
|   |   `-- safe.py                # live -> cache -> fixture fetch wrapper
|   |-- compute/               # pure maths: no network, no LLM
|   |   |-- constants.py           # Mars radius, gravity (each with a source)
|   |   `-- route.py               # haversine_m, sample_dem, slope_profile
|   `-- api/                   # FastAPI (week 2): validate -> compute -> contract shape
|
|-- web/                       # static frontend (talks only to our API)
|   `-- README.md                  # element ids and the route:changed event
|
|-- tests/
|   `-- test_route.py          # week 1 spec: fails until implemented
|
|-- docs/
|   |-- contract.md            # request/response shapes (do not change without approval)
|   |-- data_sources.md        # every dataset: URL, resolution, date, cache path
|   |-- reference_sheet.md     # every constant: value, unit, source, confirmed/assumption
|   |-- map_notes.md           # projection, tile URL, longitude convention
|   `-- AI_USE.md              # every AI tool, what it did, what we did ourselves
|
|-- cache/                     # gitignored: DEM (COG), tiles (PMTiles), downloads
`-- demo_fixtures/             # committed: the minimum data the offline demo needs
```

## Files added in later weeks

| Week | File | Purpose |
|---|---|---|
| 2 | `src/compute/energy.py` | time and energy per profile (ledgers never merged) |
| 2 | `src/compute/hazards.py` | slope limit, roughness, return distance, exposure |
| 2 | `src/api/main.py` | `POST /route`, follows `docs/contract.md` |
| 2 | `web/index.html`, `web/app.js`, `web/style.css` | page, map, elevation chart |
| 3 | `web/survival-card.js` | pass/fail card with reason and safe stops |
| 3 | `tests/test_energy.py`, `tests/test_hazards.py`, `tests/test_validation.py` | unit tests and real-traverse validation |
| 3 | `demo_fixtures/*` | exact bytes the demo needs |
| 4 | `docs/DEMO_SCRIPT.md` | 240 s and 30 s video scripts |

## Data flow

```
Mars Trek tiles --> PMTiles --\
                               >-- web/ (map, draw route)
NASA DEM (COG) ----------------/         |
                                         | route:changed [[lon, lat], ...]
                                         v
                              src/api  POST /route
                                         |
                    profiles/*.json  --> src/compute (sample DEM, slope, time, energy, hazards)
                                         |
                                         v
                    response (docs/contract.md) --> survival card + elevation profile
```

Rules that shape the layout:

1. `src/compute` has no network and no LLM; every number is computed and tested.
2. No rover-versus-human branching in code; differences live in `profiles/*.json`.
3. Frontend never calls NASA directly; API reads `cache/` or `demo_fixtures/`.
4. Every constant and dataset has a source line in `docs/`.
5. `OFFLINE=1` forces fixtures; the UI shows `live`, `cache` or `fixture` next to data.

## Ownership

| Area | Owner |
|---|---|
| Repo, contract, `web/` frame, review | Imran |
| `web/` map and drawing | Afrazur |
| `src/compute`, `src/acquire`, DEM data | Masum |
| `profiles/`, `docs/reference_sheet.md`, validation traverse | Maksumul |

## Commands

```
make setup            # install dependencies
make test             # pytest (must pass before a task is done)
make lint             # ruff check + format check
make run              # API on :8000 (week 2+)
OFFLINE=1 make run    # offline demo mode
```
