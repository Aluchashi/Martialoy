# Martialoy

**A dual-profile route planner for human and rover explorers on Mars.**

Draw a route on Mars and get a verdict: is it safe, how much energy does it cost, and what science lies along the way.

> NASA Space Apps Challenge 2026, Bangladesh edition
> Theme: *The Next Frontier*
> Challenge: *Interplanetary Survival Guide: Martian Map*

---

## Project status

| Item | Status |
|---|---|
| Stage | Pre-plan / prescreening |
| Live demo | _Coming soon_ |
| 240-second video | _Link to be added_ |
| 30-second video | _Link to be added_ |

This README describes the planned design. Items marked **(stretch)** are built only after the MVP is complete.

---

## The problem

The information needed to plan a surface route on Mars (terrain, energy cost, hazards and science targets) sits in separate datasets and tools. Most route tools are either rover-centred or terrain-centred. Few place human and rover explorers side by side, with separate energy accounting and a science layer, in a single view.

**Research question:** How can one shared route engine judge the same route under two different energy models: electrical-only for a rover, and suit power plus metabolic effort for a human?

## The solution

Martialoy is a website. The user selects a region, draws a route, and chooses an explorer type. The engine computes the route against real NASA data and returns a judgment.

```
select region -> draw route -> choose profile -> compute -> check hazards -> survival card
```

**Design principle:** the engine contains no rover-versus-human branching. A rover and a human astronaut are two *profiles* (mass, base power draw, climb cost, speed, slope limit, energy type) run through the same engine.

## Features

**MVP (must ship)**
- One region with cached terrain data (for example, Jezero Crater)
- Route drawing with distance, slope and travel time computed
- Dual energy model with a Human / Rover toggle
- Hazard flags per route segment
- Survival card (pass/fail, energy used, safe stopping points, reason for failure)
- On-screen data citations and full offline operation

**Stretch goals**
- Science-interest layer: real rover discoveries and mineral signatures near the route
- Contingency route suggestion when a route fails
- Bangla language toggle

**Out of scope:** whole-planet coverage, real-time data, live rover control, medical-grade human physiology.

## Energy models

The two energy types are tracked separately and are never merged into one number.

| Profile | Ledgers | Unit |
|---|---|---|
| Rover | Electrical energy | Wh |
| Human | Suit electrical energy and metabolic energy | Wh and kcal |

Each ledger is checked against its own limit.

## Method

- **Slope:** angle computed from adjacent elevation points along the route.
- **Distance and time:** segment length divided by explorer speed, with speed adjusted by slope.
- **Energy:** `base power x time + climb cost x elevation gain`.
- **Hazard rules:** slope above the profile limit, rough-terrain score, return distance beyond the safe energy budget, and exposure limits for humans.
- **Assumptions:** simplified physics, Mars gravity of about 0.38 g, constant environmental conditions.
- **Validation:** compare computed results with at least one real rover traverse, and test usability with a few non-expert users.

## Data sources

All sources are open NASA data. Every constant used in the explorer profiles is recorded with its source and link in a single reference sheet (`docs/references`), so claims can be checked.

| Data | Used for | Source |
|---|---|---|
| Elevation and terrain | Slope, distance | NASA Mars Trek |
| High-resolution imagery | Rough terrain, visual context | HiRISE, via the Planetary Data System (PDS) |
| Mineral maps | Science points | CRISM, via PDS |
| Rover mission records | Science points, validation | NASA mission pages and PDS |
| Rover specifications | Rover profile constants | NASA mission fact sheets |
| Spacesuit and metabolic data | Human profile constants | NASA human spaceflight reports |

> The list will be verified against the official 2026 challenge statement (released 28 October 2026).

## Limitations

The model is simplified and is **not** intended for mission-grade or medical use. All assumptions are listed openly above.

## Repository structure

_Planned layout; update as the project grows._

```
.
├── README.md
├── LICENSE
├── src/            # web app: map interface, route engine, profiles
├── data/           # cached terrain data and processing scripts
├── docs/           # documentation, reference sheet, project plan
└── media/          # screenshots and demo assets
```

## Getting started

_To be filled in once the first build is ready._

```bash
git clone https://github.com/<your-username>/martialoy.git
cd martialoy
# install and run instructions go here
```

## Use of AI

AI tools used in this project, the prompts and reasoning behind them, and the data they worked on will be listed here, as required by the Space Apps rules.

| Tool | Used for | Notes |
|---|---|---|
| _To be filled_ | | |

## Team

| Member | Role | Responsibility |
|---|---|---|
| Md. Imran Hasan | Team Lead | Architecture, Git workflow and code review, integration testing, deadlines, final pitch |
| Afrazur Rahman | Technical | Map interface, route drawing, hazard overlay, survival card, offline deployment, GitHub repo |
| Md. Masum Parvej | Data Engine | Elevation (DEM) processing, slope, route segmentation, energy model, explorer profiles |
| Maksumul Haque | Science and Research | Reference constants and citations, documentation, project page, videos |

## License

_Choose a license before the hackathon (for example MIT). Space Apps requires code built during the event to stay open source._

## Acknowledgements

Data and mission information from NASA and its open data programs (Mars Trek, HiRISE, CRISM, Planetary Data System). Built for the NASA International Space Apps Challenge 2026.
