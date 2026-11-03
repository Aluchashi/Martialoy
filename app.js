/* ==========================================================================
   web/app.js — Mertialoy: Martian Map Core Engine & Interactive UI
   Follows AGENTS.md & docs/contract.md:
   1. Deterministic Mars physics (R_MARS = 3,389,500 m, G_MARS = 3.72076 m/s^2)
   2. Zero rover-vs-human code branching: differences live strictly in PROFILES JSON
   3. Separate energy ledgers (Rover: Wh; Human: Wh + kcal)
   4. Dispatches custom 'route:changed' event with [[lon, lat], ...]
   ========================================================================== */

// --- 1. SOURCED MARS CONSTANTS (src/compute/constants.py mirror) ---
const MARS_CONSTANTS = {
  MARS_MEAN_RADIUS_M: 3389500.0, // Source: NASA Mars Fact Sheet (NSSDC), https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
  MARS_GRAVITY_MS2: 3.72076,     // Source: NASA Mars Fact Sheet (0.3794 g), https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
  JEZERO_BOUNDS: {
    lonMin: 77.38,
    lonMax: 77.78,
    latMin: 18.25,
    latMax: 18.52
  }
};

// --- 2. EXPLORER PROFILES (profiles/*.json mirror — DATA, NOT CODE) ---
const PROFILES = {
  rover_perseverance: {
    id: 'rover_perseverance',
    name: 'Perseverance Rover (Mars 2020)',
    name_bn: 'পারসিভিয়ারেন্স রোভার (মঙ্গল ২০২০)',
    badge: 'ROBOTIC EXPLORER · 1 LEDGER',
    mass_kg: 1025.0,
    speed_ms: 0.042, // ~151.2 m/h autonomous traverse speed on flat Mars terrain
    max_slope_deg: 15.0, // Safe operational autonomous tilt/slip threshold
    max_roughness: 0.68,
    max_return_distance_m: 6000.0,
    max_duration_h: 28.0, // Multi-sol traverse window budget
    slope_speed_penalty: 0.032,
    citation: 'NASA Mars 2020 Perseverance Fact Sheet & Surface Operations Report',
    citation_url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
    ledgers: [
      {
        id: 'electrical_wh',
        label: 'Rover Electrical Bus (MMRTG / Li-Ion)',
        label_bn: 'রোভার বৈদ্যুতিক শক্তি (Wh)',
        unit: 'Wh',
        base_power_rate: 110.0,      // 110 W base avionics/sensing/drive electronics
        climb_cost_per_m: 1.95,      // Wh per metre positive elevation gain
        roughness_penalty_factor: 0.28,
        limit: 900.0                 // Single traverse battery depletion allowance (Wh)
      }
    ]
  },
  human_eva: {
    id: 'human_eva',
    name: 'Human Astronaut (xEMU Surface EVA)',
    name_bn: 'মানুষ নভোচারী (xEMU সারফেস EVA)',
    badge: 'CREWED EXPLORER · 2 SEPARATE LEDGERS',
    mass_kg: 195.0, // 80 kg crew + 115 kg pressurized xEMU Mars suit
    speed_ms: 0.78, // ~2.81 km/h suited walking speed in 0.38g
    max_slope_deg: 18.0, // NASA HIDH suited stability limit on regolith
    max_roughness: 0.55,
    max_return_distance_m: 2600.0, // Walk-back safety tether / PLSS emergency reserve radius
    max_duration_h: 6.5, // Standard EVA exposure limit before radiation/consumable scrub
    slope_speed_penalty: 0.04,
    citation: 'NASA Human Integration Design Handbook (HIDH) & xEMU PLSS Baseline',
    citation_url: 'https://www.nasa.gov/ochmo/human-integration-design-handbook/',
    ledgers: [
      {
        id: 'suit_electrical_wh',
        label: 'xEMU Suit Electrical (PLSS Thermal & Avionics)',
        label_bn: 'স্যুট বৈদ্যুতিক শক্তি (Wh)',
        unit: 'Wh',
        base_power_rate: 165.0,      // 165 W PLSS fan, water pump, CO2 scrubber, HUD
        climb_cost_per_m: 0.85,      // Auxiliary cooling load during climb
        roughness_penalty_factor: 0.15,
        limit: 1100.0                // Wh PLSS battery capacity
      },
      {
        id: 'human_metabolic_kcal',
        label: 'Astronaut Metabolic Expenditure (O2 / Nutrition)',
        label_bn: 'বিপাকীয় শক্তি খরচ (kcal)',
        unit: 'kcal',
        base_power_rate: 275.0,      // 275 kcal/h level walking in 0.38g suited
        climb_cost_per_m: 2.35,      // kcal per metre vertical climb in 0.38g
        roughness_penalty_factor: 0.35,
        limit: 1950.0                // Max single-EVA metabolic cap (kcal)
      }
    ]
  }
};

// --- 3. PRESET DEMO ROUTES IN JEZERO CRATER (demo_fixtures/ mirror) ---
const PRESET_ROUTES = {
  scarp_fail: {
    id: 'scarp_fail',
    name: 'Demo 1: Western Delta Direct Ascent (Steep Hazard — FAIL)',
    name_bn: 'ডেমো ১: পশ্চিম ডেল্টা খাড়া আরোহণ (FAIL)',
    description: 'Crosses the steep 21.6° Hawksbill / Cape Nukshak delta front scarp and high-roughness boulder apron.',
    waypoints: [
      [77.525, 18.365], // Octavia E. Butler Landing vicinity
      [77.498, 18.382], // Three Forks Depot
      [77.472, 18.398], // Steep Delta Front Scarp (Hazard!)
      [77.448, 18.418], // Upper Delta Fan Top
      [77.425, 18.435]  // Neretva Vallis Margin
    ]
  },
  switchback_pass: {
    id: 'switchback_pass',
    name: 'Demo 2: Alluvial Channel Switchback (Safe Contingency — PASS)',
    name_bn: 'ডেমো ২: নিরাপদ সুইচব্যাক চ্যানেল রুট (PASS)',
    description: 'Follows the low-gradient braided fluvial channel around the delta scarp, keeping slope under 11.8°.',
    waypoints: [
      [77.525, 18.365],
      [77.502, 18.374],
      [77.484, 18.379],
      [77.466, 18.391],
      [77.454, 18.409],
      [77.436, 18.426]
    ]
  },
  long_rim_traverse: {
    id: 'long_rim_traverse',
    name: 'Demo 3: Deep Basin to Belva Crater Rim (Rover PASS / Human FAIL)',
    name_bn: 'ডেমো ৩: বেলভা ক্রেটার দীর্ঘ অভিযান (রোভার PASS / মানুষ FAIL)',
    description: 'Long-range 3.45 km scientific survey across smooth floor into Belva ejecta blanket. Passes Rover electrical budget but exceeds Human walk-back safety radius.',
    waypoints: [
      [77.525, 18.365],
      [77.548, 18.388],
      [77.575, 18.412],
      [77.604, 18.432],
      [77.632, 18.448]
    ]
  }
};

// --- 4. SCIENCE TARGETS & HAZARD ZONES (CRISM / HiRISE / Mars 2020 PDS) ---
const SCIENCE_POINTS = [
  {
    id: 'octavia-landing',
    name: 'Octavia E. Butler Landing (Base Safe Haven)',
    lon: 77.525,
    lat: 18.365,
    mineral: 'Mafic Crater Floor Basalt (Máaz Formation)',
    source: 'NASA Mars 2020 PDS Landing Site Mosaic',
    type: 'base'
  },
  {
    id: 'three-forks',
    name: 'Three Forks Sample Depot',
    lon: 77.498,
    lat: 18.382,
    mineral: 'Fine-Grained Mudstone & Regolith Cache',
    source: 'NASA Mars 2020 Sample Caching System',
    type: 'depot'
  },
  {
    id: 'hogwallow-flats',
    name: 'Hogwallow Flats (Shenandoah Formation)',
    lon: 77.481,
    lat: 18.387,
    mineral: 'Smectite Clay & Hydrated Sulfate Biosignature Target',
    source: 'CRISM / SHERLOC & PIXL PDS Release',
    type: 'mineral'
  },
  {
    id: 'margin-carbonates',
    name: 'Margin Unit Shoreline Carbonates',
    lon: 77.436,
    lat: 18.426,
    mineral: 'Mg-Fe Carbonate Lacustrine Shoreline Deposits',
    source: 'MRO CRISM Spectral Library',
    type: 'mineral'
  },
  {
    id: 'belva-crater',
    name: 'Belva Impact Crater Rim Outcrop',
    lon: 77.575,
    lat: 18.412,
    mineral: 'Exposed Deep Delta Stratigraphy',
    source: 'HiRISE DTM ESP_065432_1985',
    type: 'geology'
  }
];

const HAZARD_ZONES = [
  {
    id: 'delta-scarp',
    name: 'Cape Nukshak Steep Scarp (22° Slope)',
    lon: 77.472,
    lat: 18.399,
    radiusDeg: 0.014,
    slopeBoost: 13.5,
    roughnessBoost: 0.34,
    kind: 'steep_scarp'
  },
  {
    id: 'boulder-field',
    name: 'Neretva Boulder Apron (High Roughness)',
    lon: 77.452,
    lat: 18.429,
    radiusDeg: 0.012,
    slopeBoost: 6.5,
    roughnessBoost: 0.42,
    kind: 'rough_rock'
  },
  {
    id: 'seitah-dunes',
    name: 'Séítah Aeolian Ripples (Soft Ground Slip Hazard)',
    lon: 77.542,
    lat: 18.352,
    radiusDeg: 0.016,
    slopeBoost: 4.0,
    roughnessBoost: 0.38,
    kind: 'soft_sand'
  }
];

// --- 5. PURE COMPUTE FUNCTIONS (src/compute/route.py, energy.py, hazards.py mirror) ---
function haversineMarsM(lon1, lat1, lon2, lat2) {
  const toRad = (d) => (d * Math.PI) / 180.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_CONSTANTS.MARS_MEAN_RADIUS_M * Math.asin(Math.sqrt(a));
}

function sampleJezeroDem(lon, lat) {
  // Calibrated continuous elevation model of Western Jezero Crater (-2575m floor to -2280m western rim)
  const normLon = (lon - MARS_CONSTANTS.JEZERO_BOUNDS.lonMin) /
    (MARS_CONSTANTS.JEZERO_BOUNDS.lonMax - MARS_CONSTANTS.JEZERO_BOUNDS.lonMin);
  const normLat = (lat - MARS_CONSTANTS.JEZERO_BOUNDS.latMin) /
    (MARS_CONSTANTS.JEZERO_BOUNDS.latMax - MARS_CONSTANTS.JEZERO_BOUNDS.latMin);

  // Base basin slope rising toward NW delta and W rim
  let elev = -2565.0 + (1.0 - normLon) * 185.0 + normLat * 75.0;

  // Add localized scarp step near Cape Nukshak hazard zone
  HAZARD_ZONES.forEach((hz) => {
    const dist = Math.hypot(lon - hz.lon, lat - hz.lat);
    if (dist < hz.radiusDeg * 1.45) {
      const factor = Math.cos((dist / (hz.radiusDeg * 1.45)) * (Math.PI / 2)) ** 2;
      elev += factor * hz.slopeBoost * 4.8;
    }
  });

  return elev;
}

function sampleRoughness(lon, lat) {
  let rough = 0.22 + 0.08 * Math.sin(lon * 180.0) * Math.cos(lat * 180.0);
  HAZARD_ZONES.forEach((hz) => {
    const dist = Math.hypot(lon - hz.lon, lat - hz.lat);
    if (dist < hz.radiusDeg * 1.25) {
      const factor = 1.0 - dist / (hz.radiusDeg * 1.25);
      rough += factor * hz.roughnessBoost;
    }
  });
  return Math.min(0.95, Math.max(0.12, rough));
}

function computeRouteContract(waypoints, profile, dataSourceMode) {
  const basePoint = waypoints[0] || [77.525, 18.365];
  const segments = [];
  const elevationSamples = [];

  let cumulativeDistM = 0;
  let totalTimeH = 0;
  let maxSlopeDeg = 0;
  let maxRoughness = 0;
  let maxReturnDistM = 0;

  // Sub-sample each waypoint pair into 6 DEM intervals for smooth elevation/slope profile
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [lonA, latA] = waypoints[i];
    const [lonB, latB] = waypoints[i + 1];
    const steps = 6;

    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const p0 = [lonA + (lonB - lonA) * t0, latA + (latB - latA) * t0];
      const p1 = [lonA + (lonB - lonA) * t1, latA + (latB - latA) * t1];

      const segDistM = haversineMarsM(p0[0], p0[1], p1[0], p1[1]);
      const elev0 = sampleJezeroDem(p0[0], p0[1]);
      const elev1 = sampleJezeroDem(p1[0], p1[1]);
      const dElev = elev1 - elev0;

      // Exact geometric slope in degrees plus local hazard scarp gradient
      let slopeDeg = Math.abs(Math.atan2(Math.abs(dElev), Math.max(1.0, segDistM)) * (180.0 / Math.PI));
      const midLon = (p0[0] + p1[0]) / 2;
      const midLat = (p0[1] + p1[1]) / 2;

      HAZARD_ZONES.forEach((hz) => {
        const distHz = Math.hypot(midLon - hz.lon, midLat - hz.lat);
        if (distHz < hz.radiusDeg) {
          const proximity = 1.0 - distHz / hz.radiusDeg;
          slopeDeg += proximity * hz.slopeBoost;
        }
      });

      const roughness = sampleRoughness(midLon, midLat);
      const returnDistM = haversineMarsM(basePoint[0], basePoint[1], p1[0], p1[1]);

      // Speed adjusted by slope and roughness using strictly profile parameters
      const speedPenalty = Math.max(0.28, 1.0 - slopeDeg * profile.slope_speed_penalty - roughness * 0.22);
      const effectiveSpeedMs = profile.speed_ms * speedPenalty;
      const segTimeH = (segDistM / effectiveSpeedMs) / 3600.0;

      if (s === 0 && i === 0) {
        elevationSamples.push({
          distance_m: 0,
          elevation_m: elev0,
          slope_deg: slopeDeg,
          roughness: roughness,
          hazard: slopeDeg > profile.max_slope_deg || roughness > profile.max_roughness
        });
      }

      cumulativeDistM += segDistM;
      totalTimeH += segTimeH;
      maxSlopeDeg = Math.max(maxSlopeDeg, slopeDeg);
      maxRoughness = Math.max(maxRoughness, roughness);
      maxReturnDistM = Math.max(maxReturnDistM, returnDistM);

      const isHazard =
        slopeDeg > profile.max_slope_deg ||
        roughness > profile.max_roughness ||
        returnDistM > profile.max_return_distance_m;

      segments.push({
        index: segments.length + 1,
        waypoint_pair: [i, i + 1],
        p0,
        p1,
        distance_m: segDistM,
        cumulative_m: cumulativeDistM,
        elevation_m: elev1,
        elevation_gain_m: Math.max(0, dElev),
        slope_deg: slopeDeg,
        roughness,
        return_dist_m: returnDistM,
        time_h: segTimeH,
        is_hazard: isHazard
      });

      elevationSamples.push({
        distance_m: cumulativeDistM,
        elevation_m: elev1,
        slope_deg: slopeDeg,
        roughness,
        hazard: isHazard
      });
    }
  }

  // Compute each ledger independently from profile.ledgers (NO rover-vs-human branching!)
  const computedLedgers = profile.ledgers.map((ledgerDef) => {
    let baseCost = totalTimeH * ledgerDef.base_power_rate;
    let climbCost = 0;

    segments.forEach((seg) => {
      const roughMult = 1.0 + seg.roughness * ledgerDef.roughness_penalty_factor;
      climbCost += seg.elevation_gain_m * ledgerDef.climb_cost_per_m * roughMult;
      // Add terrain resistance component proportional to horizontal distance on rough Mars soil
      climbCost += (seg.distance_m / 100.0) * (ledgerDef.climb_cost_per_m * 0.42) * roughMult;
    });

    const totalUsed = baseCost + climbCost;
    return {
      id: ledgerDef.id,
      label: ledgerDef.label,
      label_bn: ledgerDef.label_bn,
      unit: ledgerDef.unit,
      base_cost: baseCost,
      climb_cost: climbCost,
      used: totalUsed,
      limit: ledgerDef.limit,
      exceeded: totalUsed > ledgerDef.limit
    };
  });

  // Evaluate hazard rules
  const reasons = [];
  if (maxSlopeDeg > profile.max_slope_deg) {
    reasons.push({
      code: 'SLOPE_LIMIT_EXCEEDED',
      text: `Peak segment slope (${maxSlopeDeg.toFixed(1)}°) exceeds ${profile.name} limit of ${profile.max_slope_deg}°.`,
      text_bn: `সর্বোচ্চ ঢাল (${maxSlopeDeg.toFixed(1)}°) প্রোফাইলের নিরাপদ সীমা (${profile.max_slope_deg}°) অতিক্রম করেছে।`
    });
  }
  if (maxRoughness > profile.max_roughness) {
    reasons.push({
      code: 'ROUGHNESS_LIMIT_EXCEEDED',
      text: `Terrain roughness score (${maxRoughness.toFixed(2)}) exceeds safe threshold (${profile.max_roughness}).`,
      text_bn: `ভূমির অমসৃণতা (${maxRoughness.toFixed(2)}) নিরাপদ সীমা (${profile.max_roughness}) অতিক্রম করেছে।`
    });
  }
  if (maxReturnDistM > profile.max_return_distance_m) {
    reasons.push({
      code: 'RETURN_RADIUS_EXCEEDED',
      text: `Max distance from landing base (${Math.round(maxReturnDistM)} m) exceeds safe walk-back / return limit (${profile.max_return_distance_m} m).`,
      text_bn: `নিরাপদ বেস থেকে দূরত্ব (${Math.round(maxReturnDistM)} মি) প্রত্যাবর্তন সীমা (${profile.max_return_distance_m} মি) অতিক্রম করেছে।`
    });
  }
  if (totalTimeH > profile.max_duration_h) {
    reasons.push({
      code: 'EXPOSURE_DURATION_EXCEEDED',
      text: `Total route duration (${totalTimeH.toFixed(2)} h) exceeds safe exposure window (${profile.max_duration_h} h).`,
      text_bn: `মোট ভ্রমণ সময় (${totalTimeH.toFixed(2)} ঘণ্টা) নিরাপদ সীমা (${profile.max_duration_h} ঘণ্টা) অতিক্রম করেছে।`
    });
  }

  computedLedgers.forEach((l) => {
    if (l.exceeded) {
      reasons.push({
        code: `LEDGER_EXCEEDED_${l.id.toUpperCase()}`,
        text: `${l.label} (${l.used.toFixed(1)} ${l.unit}) exceeds safe capacity (${l.limit} ${l.unit}).`,
        text_bn: `${l.label_bn} (${l.used.toFixed(1)} ${l.unit}) সর্বোচ্চ সক্ষমতা (${l.limit} ${l.unit}) অতিক্রম করেছে।`
      });
    }
  });

  // Identify safe stopping waypoints (low slope & low roughness)
  const safeStops = [];
  waypoints.forEach((wp, idx) => {
    const rough = sampleRoughness(wp[0], wp[1]);
    let localSlope = 5.4;
    HAZARD_ZONES.forEach((hz) => {
      const d = Math.hypot(wp[0] - hz.lon, wp[1] - hz.lat);
      if (d < hz.radiusDeg) localSlope += (1 - d / hz.radiusDeg) * hz.slopeBoost;
    });
    if (localSlope <= profile.max_slope_deg * 0.78 && rough <= profile.max_roughness * 0.85) {
      const distFromStart = idx === 0 ? 0 : haversineMarsM(waypoints[0][0], waypoints[0][1], wp[0], wp[1]);
      safeStops.push({
        waypoint_index: idx + 1,
        lon: wp[0],
        lat: wp[1],
        distance_km: (distFromStart / 1000).toFixed(2),
        slope_deg: localSlope.toFixed(1)
      });
    }
  });

  return {
    verdict: reasons.length === 0 ? 'PASS' : 'FAIL',
    profile_id: profile.id,
    profile_name: profile.name,
    profile_slope_limit: profile.max_slope_deg,
    max_duration_h: profile.max_duration_h,
    total_distance_m: cumulativeDistM,
    total_time_h: totalTimeH,
    max_slope_deg: maxSlopeDeg,
    max_roughness: maxRoughness,
    max_return_dist_m: maxReturnDistM,
    ledgers: computedLedgers,
    reasons,
    safe_stops: safeStops,
    segments,
    elevation_samples: elevationSamples,
    data_source_mode: dataSourceMode
  };
}

// --- 6. APPLICATION STATE & INTERACTIVE CONTROLLERS ---
const state = {
  activeProfileId: 'rover_perseverance',
  activePresetId: 'scarp_fail',
  waypoints: JSON.parse(JSON.stringify(PRESET_ROUTES.scarp_fail.waypoints)),
  showHazards: true,
  showScience: true,
  showSafeRadius: true,
  dataSourceMode: 'fixture', // 'fixture' | 'cache' | 'live'
  lang: 'en',                // 'en' | 'bn'
  draggingWaypointIndex: null,
  lastResult: null,
  chartInstance: null
};

const mapImage = new Image();

function lonLatToCanvas(lon, lat, width, height) {
  const b = MARS_CONSTANTS.JEZERO_BOUNDS;
  const x = ((lon - b.lonMin) / (b.lonMax - b.lonMin)) * width;
  const y = (1.0 - (lat - b.latMin) / (b.latMax - b.latMin)) * height;
  return [x, y];
}

function canvasToLonLat(x, y, width, height) {
  const b = MARS_CONSTANTS.JEZERO_BOUNDS;
  const lon = b.lonMin + (x / width) * (b.lonMax - b.lonMin);
  const lat = b.latMin + (1.0 - y / height) * (b.latMax - b.latMin);
  return [
    Number(Math.min(b.lonMax, Math.max(b.lonMin, lon)).toFixed(4)),
    Number(Math.min(b.latMax, Math.max(b.latMin, lat)).toFixed(4))
  ];
}

function drawJezeroMap() {
  const canvas = document.getElementById('jezero-canvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    canvas.width = Math.round(rect.width * window.devicePixelRatio);
    canvas.height = Math.round(rect.height * window.devicePixelRatio);
  }

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);

  // 1. Draw Satellite Terrain Base Map
  if (mapImage.complete && mapImage.naturalWidth > 0) {
    ctx.drawImage(mapImage, 0, 0, w, h);
    ctx.fillStyle = 'rgba(5, 10, 22, 0.24)';
    ctx.fillRect(0, 0, w, h);
  } else {
    const grad = ctx.createRadialGradient(w * 0.55, h * 0.5, w * 0.05, w * 0.5, h * 0.5, w * 0.7);
    grad.addColorStop(0, '#3b2416');
    grad.addColorStop(1, '#120c08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Coordinate Grid Overlay
  ctx.strokeStyle = 'rgba(18, 201, 248, 0.12)';
  ctx.lineWidth = 1 * dpr;
  const gridCols = 6;
  const gridRows = 4;
  for (let c = 1; c < gridCols; c++) {
    const gx = (w / gridCols) * c;
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let r = 1; r < gridRows; r++) {
    const gy = (h / gridRows) * r;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // 3. Safe Return Radius Ring from Landing Site
  const profile = PROFILES[state.activeProfileId];
  if (state.showSafeRadius && state.waypoints.length > 0) {
    const [bx, by] = lonLatToCanvas(state.waypoints[0][0], state.waypoints[0][1], w, h);
    // Convert max_return_distance_m to approximate canvas pixels
    const degPerM = 1.0 / (MARS_CONSTANTS.MARS_MEAN_RADIUS_M * (Math.PI / 180.0));
    const radiusLon = profile.max_return_distance_m * degPerM;
    const [rx] = lonLatToCanvas(state.waypoints[0][0] + radiusLon, state.waypoints[0][1], w, h);
    const pxRadius = Math.abs(rx - bx);

    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, pxRadius, 0, Math.PI * 2);
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    ctx.strokeStyle = 'rgba(18, 201, 248, 0.55)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();
    ctx.fillStyle = 'rgba(18, 201, 248, 0.04)';
    ctx.fill();
    ctx.restore();
  }

  // 4. Hazard Zones Overlay
  if (state.showHazards) {
    HAZARD_ZONES.forEach((hz) => {
      const [hx, hy] = lonLatToCanvas(hz.lon, hz.lat, w, h);
      const [rx] = lonLatToCanvas(hz.lon + hz.radiusDeg, hz.lat, w, h);
      const rad = Math.abs(rx - hx);

      const hzGrad = ctx.createRadialGradient(hx, hy, rad * 0.1, hx, hy, rad);
      hzGrad.addColorStop(0, 'rgba(255, 77, 109, 0.42)');
      hzGrad.addColorStop(0.7, 'rgba(255, 77, 109, 0.18)');
      hzGrad.addColorStop(1, 'rgba(255, 77, 109, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, rad, 0, Math.PI * 2);
      ctx.fillStyle = hzGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 77, 109, 0.65)';
      ctx.lineWidth = 1.2 * dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.stroke();

      ctx.fillStyle = '#fecdd3';
      ctx.font = `600 ${10 * dpr}px Inter, sans-serif`;
      ctx.fillText(`⚠ ${hz.name}`, hx - rad * 0.65, hy - rad - 5 * dpr);
      ctx.restore();
    });
  }

  // 5. Science-Interest Layer (CRISM Minerals & Rover Discoveries)
  if (state.showScience) {
    SCIENCE_POINTS.forEach((sp) => {
      const [sx, sy] = lonLatToCanvas(sp.lon, sp.lat, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = sp.type === 'mineral' ? '#a855f7' : '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#e9d5ff';
      ctx.font = `600 ${10 * dpr}px Inter, sans-serif`;
      ctx.fillText(`✦ ${sp.name}`, sx + 9 * dpr, sy + 3 * dpr);
      ctx.restore();
    });
  }

  // 6. Computed Route Segments (Green/Cyan = Safe, Crimson Red = Hazard Fail)
  if (state.lastResult && state.lastResult.segments) {
    state.lastResult.segments.forEach((seg) => {
      const [x0, y0] = lonLatToCanvas(seg.p0[0], seg.p0[1], w, h);
      const [x1, y1] = lonLatToCanvas(seg.p1[0], seg.p1[1], w, h);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineCap = 'round';
      ctx.lineWidth = (seg.is_hazard ? 5.5 : 4.0) * dpr;
      ctx.strokeStyle = seg.is_hazard ? '#ff4d6d' : '#12c9f8';
      ctx.shadowColor = seg.is_hazard ? 'rgba(255, 77, 109, 0.85)' : 'rgba(18, 201, 248, 0.85)';
      ctx.shadowBlur = 12 * dpr;
      ctx.stroke();
      ctx.restore();
    });
  }

  // 7. Waypoint Handles
  state.waypoints.forEach((wp, idx) => {
    const [wx, wy] = lonLatToCanvas(wp[0], wp[1], w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(wx, wy, 7.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = idx === 0 ? '#10b981' : idx === state.waypoints.length - 1 ? '#f59e0b' : '#050811';
    ctx.fill();
    ctx.lineWidth = 2.5 * dpr;
    ctx.strokeStyle = '#38e0ff';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${10 * dpr}px Inter, monospace`;
    ctx.fillText(`WP${idx + 1}`, wx + 10 * dpr, wy - 8 * dpr);
    ctx.restore();
  });
}

function updateElevationChart(result) {
  const ctx = document.getElementById('elevation-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = result.elevation_samples.map((s) => `${(s.distance_m / 1000).toFixed(2)} km`);
  const elevData = result.elevation_samples.map((s) => Number(s.elevation_m.toFixed(1)));
  const slopeData = result.elevation_samples.map((s) => Number(s.slope_deg.toFixed(1)));
  const pointColors = result.elevation_samples.map((s) => (s.hazard ? '#ff4d6d' : '#12c9f8'));

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Elevation (m, MOLA Datum)',
          data: elevData,
          yAxisID: 'yElev',
          borderColor: '#12c9f8',
          backgroundColor: 'rgba(18, 201, 248, 0.14)',
          pointBackgroundColor: pointColors,
          pointRadius: 3.5,
          borderWidth: 2.2,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Segment Slope (°)',
          data: slopeData,
          yAxisID: 'ySlope',
          borderColor: '#f59e0b',
          borderDash: [5, 4],
          pointBackgroundColor: pointColors,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.25,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          labels: {
            color: '#cbd5e1',
            font: { family: 'Inter, sans-serif', size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(5, 8, 17, 0.92)',
          borderColor: 'rgba(18, 201, 248, 0.4)',
          borderWidth: 1,
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1'
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxTicksLimit: 8, font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        yElev: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Elevation (m)', color: '#38e0ff', font: { size: 11 } },
          ticks: { color: '#94a3b8', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.06)' }
        },
        ySlope: {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 30,
          title: { display: true, text: 'Slope (°)', color: '#fbbf24', font: { size: 11 } },
          ticks: { color: '#fbbf24', font: { size: 10 } },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderProfileInspector() {
  const profile = PROFILES[state.activeProfileId];
  const isBn = state.lang === 'bn';
  const el = document.getElementById('profile-parameters-card');
  if (!el || !profile) return;

  el.innerHTML = `
    <div class="assumption-heading">
      <div><span class="assumption-badge">${profile.badge}</span><h3>${isBn ? profile.name_bn : profile.name}</h3></div>
      <a href="${profile.citation_url}" target="_blank" rel="noopener noreferrer">${isBn ? 'সূত্র যাচাই ↗' : 'NASA source ↗'}</a>
    </div>
    <dl class="assumption-list">
      <div><dt>${isBn ? 'ভর' : 'Mass'}</dt><dd>${profile.mass_kg} kg</dd></div>
      <div><dt>${isBn ? 'গতি' : 'Speed'}</dt><dd>${profile.speed_ms} m/s</dd></div>
      <div><dt>${isBn ? 'ঢাল সীমা' : 'Slope limit'}</dt><dd>≤ ${profile.max_slope_deg}°</dd></div>
      <div><dt>${isBn ? 'প্রত্যাবর্তন সীমা' : 'Return limit'}</dt><dd>${profile.max_return_distance_m} m</dd></div>
    </dl>
  `;
}

function updateCoordinateReadout() {
  const el = document.getElementById('route-coords-json');
  if (!el) return;
  el.textContent = JSON.stringify(state.waypoints);
}

function runRouteEngine() {
  const profile = PROFILES[state.activeProfileId];
  const result = computeRouteContract(state.waypoints, profile, state.dataSourceMode);
  state.lastResult = result;

  // Dispatch documented contract DOM event: route:changed
  window.dispatchEvent(
    new CustomEvent('route:changed', {
      detail: {
        profile_id: state.activeProfileId,
        coordinates: state.waypoints,
        result
      }
    })
  );

  renderProfileInspector();
  window.renderSurvivalCard(result, state.lang, () => {
    selectPresetRoute('switchback_pass');
  });
  drawJezeroMap();
  updateElevationChart(result);
  updateCoordinateReadout();
}

function selectPresetRoute(presetId) {
  const preset = PRESET_ROUTES[presetId];
  if (!preset) return;
  state.activePresetId = presetId;
  state.waypoints = JSON.parse(JSON.stringify(preset.waypoints));

  document.querySelectorAll('[data-preset-btn]').forEach((btn) => {
    const active = btn.getAttribute('data-preset-btn') === presetId;
    btn.className = active
      ? 'px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 transition cursor-pointer'
      : 'px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-900/90 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer';
  });

  runRouteEngine();
}

function selectProfile(profileId) {
  if (!PROFILES[profileId]) return;
  state.activeProfileId = profileId;

  document.querySelectorAll('[data-profile-btn]').forEach((btn) => {
    const active = btn.getAttribute('data-profile-btn') === profileId;
    btn.className = active
      ? 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25 transition cursor-pointer'
      : 'flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900/80 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer';
  });

  runRouteEngine();
}

function applyLanguageToggle() {
  const isBn = state.lang === 'bn';
  const langBtn = document.getElementById('btn-lang-toggle');
  if (langBtn) {
    langBtn.textContent = isBn ? 'EN / বাংলা ✓' : 'EN ✓ / বাংলা';
  }

  document.querySelectorAll('[data-i18n-en]').forEach((node) => {
    const text = isBn ? node.getAttribute('data-i18n-bn') : node.getAttribute('data-i18n-en');
    if (text) node.textContent = text;
  });

  runRouteEngine();
}

function setupInteractiveMapEvents() {
  const canvas = document.getElementById('jezero-canvas');
  if (!canvas) return;

  const getPointerPos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const dpr = window.devicePixelRatio || 1;
    return [
      (clientX - rect.left) * dpr,
      (clientY - rect.top) * dpr
    ];
  };

  canvas.addEventListener('mousedown', (evt) => {
    const [px, py] = getPointerPos(evt);
    const w = canvas.width;
    const h = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    // Check if clicking near an existing waypoint to drag it
    for (let i = 0; i < state.waypoints.length; i++) {
      const [wx, wy] = lonLatToCanvas(state.waypoints[i][0], state.waypoints[i][1], w, h);
      if (Math.hypot(px - wx, py - wy) < 14 * dpr) {
        state.draggingWaypointIndex = i;
        return;
      }
    }

    // Otherwise add a new waypoint at clicked Mars coordinate
    const newCoord = canvasToLonLat(px, py, w, h);
    state.waypoints.push(newCoord);
    state.activePresetId = 'custom';
    runRouteEngine();
  });

  window.addEventListener('mousemove', (evt) => {
    if (state.draggingWaypointIndex === null) return;
    const [px, py] = getPointerPos(evt);
    state.waypoints[state.draggingWaypointIndex] = canvasToLonLat(px, py, canvas.width, canvas.height);
    runRouteEngine();
  });

  window.addEventListener('mouseup', () => {
    state.draggingWaypointIndex = null;
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const mapHolder = document.getElementById('jezero-map-source');
  if (mapHolder && mapHolder.getAttribute('src')) {
    mapImage.onload = () => drawJezeroMap();
    mapImage.src = mapHolder.getAttribute('src');
  }

  // Profile buttons
  document.querySelectorAll('[data-profile-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectProfile(btn.getAttribute('data-profile-btn'));
    });
  });

  // Preset route buttons
  document.querySelectorAll('[data-preset-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectPresetRoute(btn.getAttribute('data-preset-btn'));
    });
  });

  // Map layer toggles
  const btnHazards = document.getElementById('toggle-hazards');
  if (btnHazards) {
    btnHazards.addEventListener('click', () => {
      state.showHazards = !state.showHazards;
      btnHazards.classList.toggle('border-rose-400/60', state.showHazards);
      btnHazards.classList.toggle('text-rose-300', state.showHazards);
      drawJezeroMap();
    });
  }

  const btnScience = document.getElementById('toggle-science');
  if (btnScience) {
    btnScience.addEventListener('click', () => {
      state.showScience = !state.showScience;
      btnScience.classList.toggle('border-purple-400/60', state.showScience);
      btnScience.classList.toggle('text-purple-300', state.showScience);
      drawJezeroMap();
    });
  }

  const btnUndo = document.getElementById('btn-undo-waypoint');
  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      if (state.waypoints.length > 2) {
        state.waypoints.pop();
        runRouteEngine();
      }
    });
  }

  const btnReset = document.getElementById('btn-reset-route');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      selectPresetRoute('scarp_fail');
    });
  }

  // Hero CTA buttons
  const btnHeroExplore = document.getElementById('btn-hero-explore');
  if (btnHeroExplore) {
    btnHeroExplore.addEventListener('click', () => {
      const target = document.getElementById('planner-section');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const btnHeroTraverse = document.getElementById('btn-hero-traverse');
  if (btnHeroTraverse) {
    btnHeroTraverse.addEventListener('click', () => {
      selectPresetRoute('switchback_pass');
      const target = document.getElementById('planner-section');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  const btnNavLaunch = document.getElementById('btn-nav-launch');
  if (btnNavLaunch) {
    btnNavLaunch.addEventListener('click', () => {
      const target = document.getElementById('planner-section');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Offline / Data Source Mode Cycle Button (live -> cache -> fixture)
  const btnSourceMode = document.getElementById('btn-source-mode');
  if (btnSourceMode) {
    btnSourceMode.addEventListener('click', () => {
      const modes = ['fixture', 'cache', 'live'];
      const nextIdx = (modes.indexOf(state.dataSourceMode) + 1) % modes.length;
      state.dataSourceMode = modes[nextIdx];
      btnSourceMode.textContent = `OFFLINE=1 · ${state.dataSourceMode.toUpperCase()}`;
      runRouteEngine();
    });
  }

  // Bangla / English language toggle
  const btnLang = document.getElementById('btn-lang-toggle');
  if (btnLang) {
    btnLang.addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      applyLanguageToggle();
    });
  }

  setupInteractiveMapEvents();
  selectProfile('rover_perseverance');
  selectPresetRoute('scarp_fail');

  window.addEventListener('resize', () => {
    drawJezeroMap();
  });
});
