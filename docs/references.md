# References and model constants

Every number used by the route engine should be traceable from this page to the
UI assumption table. Values marked **engineering estimate** are deliberately
conservative modelling choices, not measured mission specifications. They are
shown on screen so a judge can challenge them.

Last reviewed: **2026-10-20**. This is a hackathon model, not a mission plan.

## Shared constants

| Constant | Value | Source | Notes |
|---|---|---|---|
| Mars volumetric mean radius | 3,389,500 m | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Used for all horizontal geometry. Spherical approximation; regional error is well below the DEM resolution. |
| Mars equatorial radius | 3,396,200 m | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Not used; recorded to make the sphere choice explicit. |
| Mars surface gravity | 3.721 m/s² | [NASA Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | Used in the climb-energy term. |
| Sample spacing | 25 m (request-configurable) | Model setting | Shown in the UI. Finer spacing resolves shorter steep steps but changes the verdict; smoothing is off by default. |
| Wh → kcal | 0.860421 | Definition (1 Wh = 860.421 cal) | Used only to present the human metabolic ledger; the two ledgers are never summed. |

## Rover profile (Perseverance-class)

| Constant | Value | Source | Status |
|---|---|---|---|
| System mass | 1,025 kg | [NASA Mars 2020 / Perseverance](https://science.nasa.gov/mission/mars-2020-perseverance/) | Published |
| Maximum speed | 4.2 cm/s (0.042 m/s) | [NASA/JPL Mars 2020 rover](https://mars.nasa.gov/mars2020/spacecraft/rover/) | Published |
| Base electrical draw | 110 W | [NASA Mars 2020 MMRTG](https://science.nasa.gov/mission/mars-2020-perseverance/) | Published MMRTG output; treated as the steady electrical load |
| Drivetrain efficiency | 45% | Engineering estimate | Includes motor, gearbox and wheel losses on slope; no published single figure |
| Slope limit | 20° | Operational planning limit | Hardware is rated to roughly 30°; 20° is a conservative traverse-planning constraint |
| Energy allocation | 5,000 Wh | Engineering estimate | Two sols at 110 W; does not model battery state of charge or heater duty cycle |
| Drive-time allocation | 48 h | Engineering estimate | Two sols of elapsed drive time |
| Uphill speed derate | 55% at the slope limit | Model assumption | Linear derate from the flat speed to 45% of flat speed at 20° |
| Minimum speed fraction | 25% | Model assumption | Prevents the speed model reaching zero on steep terrain |

## Human profile (suited astronaut)

| Constant | Value | Source | Status |
|---|---|---|---|
| System mass (crew + suit) | 200 kg | [NASA spacesuit references](https://www.nasa.gov/humans-in-space/spacesuits/) | Draft: 80 kg crew + 120 kg suit/PLSS |
| Suited walk speed | 0.9 m/s | [NASA Apollo surface mobility](https://www.nasa.gov/the-apollo-program/) | Apollo-analog estimate; suited speed varies with terrain and workload |
| Suit base power | 100 W | [NASA spacesuit / PLSS references](https://www.nasa.gov/humans-in-space/spacesuits/) | Draft PLSS electrical load |
| Suit battery | 1,200 Wh | Engineering estimate | Eight-hour excursion allocation |
| Slope limit | 25° | Engineering estimate | Conservative suited-walking limit |
| Excursion limit | 8 h | Engineering estimate | Suit consumables / operational allocation |
| Metabolic rate, walking | 300 W | [NASA metabolic references](https://www.nasa.gov/humans-in-space/spacesuits/) | Draft; actual rate depends on speed, slope, suit and workload |
| Body climb efficiency | 25% | Engineering estimate | Mechanical work divided by metabolic energy |
| Uphill speed derate | 60% at the slope limit | Model assumption | Linear derate to 40% of flat speed at 25° |
| Minimum speed fraction | 35% | Model assumption | Prevents a zero-speed singularity |

## Terrain and route data

| Layer | Product | Source | Status |
|---|---|---|---|
| Basemap | NASA Mars Trek regional mosaic, exported to PMTiles | [NASA Mars Trek](https://trek.nasa.gov/mars/) | Cached locally in `cache/mars/`; not downloaded at runtime |
| DEM | Jezero stereo DTM / Mars Trek blended DEM, COG | [NASA PDS](https://pds.nasa.gov/) | Must be placed in `cache/mars/`; see `docs/data.md` |
| Imagery context (stretch) | HiRISE | [NASA PDS](https://pds.nasa.gov/) | Not part of the MVP |
| Mineral context layer | CRISM MTRDR OLINDEX3, product `HRL000040FF_07_SR183J_MTR3` | [NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/) | Partial-coverage spectral index; not a confirmed mineral detection |

## Model equations

```
ds_i   = geodesic distance between adjacent samples                  [m]
dh_i   = h_i - h_(i-1)                                               [m]
slope_i = atan2(dh_i, ds_i)                                          [deg]

v_i    = v_max * clamp(1 - derate * max(slope_i, 0) / slope_limit,
                       min_speed_fraction, 1)                        [m/s]
t_i    = ds_i / v_i                                                  [s]

E_Wh   = P_base * sum(t_i)/3600
         + (m * g * climb_m) / (eta_drive * 3600)                    [Wh]

E_kcal = (P_metabolic * sum(t_i)/3600
          + (m * g * climb_m) / (eta_body * 3600)) * 0.860421        [kcal]
```

`climb_m` is the sum of positive elevation changes only. Descents are not
credited back as recovered energy. The human suit ledger and the metabolic
ledger are reported separately.

## Deliberate simplifications

- Constant gravity; no latitude or elevation correction.
- No wheel slip, dust, sand traps, thermal duty cycle, or battery charge curve.
- No wind, radiation, communication windows, or daylight model.
- No terrain roughness term in the MVP; only slope and distance.
- No elevation smoothing by default; smoothing can hide a short steep step.
- Planetocentric latitude and Mars-areoid heights are assumed for all DEM input.
- The least-cost path uses an 8-neighbour grid and a distance-plus-slope-squared
  penalty. It is a planning aid, not a certified traversability analysis.

## Citation

If you use this model, cite the repository and the NASA products listed above.
Suggested text:

> Martialoy traverse model (2026), with terrain from NASA Mars Trek and the
> Planetary Data System. Model constants and limitations are documented in
> `docs/references.md`.
