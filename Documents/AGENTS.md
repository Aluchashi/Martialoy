# Martian Map: agent rules

Web tool for NASA Space Apps 2026 (Challenge 11, Interplanetary Survival Guide: Martian Map).
The user draws a route on Mars (default region: Jezero Crater), picks Human or Rover, and gets a
survival card: distance, slope, time, energy, hazards, PASS/FAIL with the reason.

## Read first, in this order

1. `docs/contract.md`: request/response shapes. Source of truth for every interface.
2. `PROJECT_STRUCTURE.md`: where things live and who owns what.
3. `ROADMAP.md`: current phase, milestone gates, MVP scope, scope-cut order.

If the task conflicts with any of these, stop and ask. Do not resolve it silently.

## Hard rules (never break)

1. **No LLM and no network in `src/compute/`.** Every number comes from deterministic, unit-tested
   Python. Never write a constant, estimate or "typical value" into code from memory.
2. **No rover-versus-human branching.** No `if profile == "human"` anywhere. All differences come
   from the JSON in `profiles/`. A new explorer is a new JSON file, not new code.
3. **Energy ledgers are never merged.** Rover: one ledger (electrical, Wh). Human: electrical (Wh)
   and metabolic (kcal), each checked against its own limit. Never sum them into one number.
4. **Every constant has a source.** A value enters `profiles/*.json` or `src/compute/constants.py`
   only with a source (URL plus page/table). Unknown value = `null` plus a note. Do not guess; ask.
5. **Mars, not Earth.** Distances use the Mars mean radius and gravity from
   `src/compute/constants.py`. Never use Earth values.
6. **Offline first.** The frontend never calls NASA directly. The API reads `cache/` or
   `demo_fixtures/`. Every fetch goes through `src/acquire/safe.py` (live, then cache, then fixture).
   `OFFLINE=1` forces fixtures. The UI shows the data source label (`live`, `cache`, `fixture`).
7. **Tests first.** Change `src/compute/` only after writing a failing test (skill `compute-change`).
   `make test` must be green before you call a task done.
8. **Cite everything.** New dataset, constant or library: log it with the skill `log-data-source`
   (`docs/data_sources.md`, `docs/reference_sheet.md`). Log AI-assisted changes in `docs/AI_USE.md`.
9. **Stay in your lane.** Edit only the files and folders the task names. Do not rename or move
   files, and do not change `docs/contract.md`, `profiles/` values or `ROADMAP.md` without being asked.

## Layout

```
profiles/        explorer profiles (JSON, sourced). Data, not code.
src/acquire/     data download and safe fetch wrapper (network allowed only here)
src/compute/     DEM sampling, slope, time, energy, hazards (pure, tested, no network)
src/api/         FastAPI app: validate request, call compute, return the contract shape
web/             static frontend; element ids and events are listed in web/README.md
tests/           pytest; mirrors src/compute
docs/            contract, data sources, reference sheet, map notes, AI use
cache/           gitignored downloads (DEM COG, tiles)
demo_fixtures/   committed minimum data the offline demo needs
```

## Commands

```
make setup           # install dependencies
make test            # pytest (must pass)
make lint            # ruff check and format check
make run             # API on :8000
OFFLINE=1 make run   # offline demo mode
```

## How to work

- One task = one branch (`feature/<name>`, `fix/<name>`, `docs/<name>`) = one small PR.
  Never push to `main`. Never merge your own PR.
- Commit messages start with `feat:`, `fix:`, `docs:`, `test:` or `chore:`.
- **Before coding:** state the plan in 3 to 5 lines and list the files you will touch.
  For anything spanning more than one folder, wait for approval of the plan.
- **After coding:** run `make test lint`, then report: what changed, which tests cover it, what is
  still `null` or unverified, and anything you were unsure about.
- Functions are small and typed. Docstrings state units (m, deg, s, h, Wh, kcal).
- Units are SI internally (metres, degrees, seconds); Wh, kcal and hours are the exceptions.
  Convert only at the edge (UI).
- Longitude is -180 to 180, east positive, everywhere inside our code. Convert at the boundary.
- Code and comments in English.

## Ask, do not guess

Stop and ask the human when:
- a profile value, constant or dataset has no source yet;
- the contract, a profile value or a test would need to change;
- two documents disagree (for example a date or a unit);
- the task needs a new dependency, a new folder, or a file outside the named scope;
- a result looks physically implausible (for example a slope above 90 degrees or negative energy).

## Never do

- Hard-code a rover or human number inside code.
- Add `try/except` that hides a failed fetch in `src/compute/`; fail loudly instead.
- Fabricate sources, URLs, citations or traverse data.
- Commit anything from `cache/`, `.env`, or credentials.
- Skip or delete a failing test to make the suite green.

## Scope reminders

- MVP (must ship): one region, route drawing, slope-distance-time, Human/Rover dual energy model,
  hazard flags, survival card, on-screen citations, full offline operation.
- Stretch, in cut order if time is short: Bangla toggle, science layer, contingency route.
- Out of scope: whole-planet coverage, real-time data, live rover control, medical-grade physiology.

## Definition of done

- [ ] `make test lint` green
- [ ] contract unchanged (or the change was approved)
- [ ] sources logged for any new data or constant
- [ ] AI use logged in `docs/AI_USE.md`
- [ ] summary written: changes, tests, open `null`s, uncertainties
