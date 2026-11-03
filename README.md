# Mertialoy (`web/` Frontend Module)

Static frontend for **Martian Map (Mertialoy)** — NASA Space Apps 2026, Challenge 11.
Visual design follows the *Space Tourism Website by Gnet Webs* dark orbital aesthetic combined with the interactive Jezero Crater dual-profile route planner.

## Files

- `index.html` — Main page structure (Hero viewport, Interactive Jezero Crater Route Planner, Survival Card, Elevation Chart, Perseverance Traverse Validation table, NASA Citations, and Team Roadmap).
- `style.css` — Custom CSS tokens, orbital portal animations, glowing cyan pill buttons, and glassmorphic surfaces.
- `app.js` — Deterministic Mars physics (`R = 3,389.5 km`, `g = 3.72076 m/s²`), zero-branching profile evaluator (`PROFILES`), interactive canvas map drawing, Chart.js elevation/slope profile, and `route:changed` custom event dispatcher.
- `survival-card.js` — Renders the pass/fail Survival Card with strictly separate energy ledgers (`Wh` for Rover; `Wh` + `kcal` for Human EVA), safe stopping points, and contingency route loader.
