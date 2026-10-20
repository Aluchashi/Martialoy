import type { Assumption, ProfileId, ProfileSpec } from '../types'

/**
 * Display copy of the rover/human parameter sets. The Python engine reads the
 * same numbers from src/compute/profiles/*.toml and serves them at
 * GET /api/profiles, so this file is the demo fallback and the source of the
 * on-screen assumption table until the backend is wired.
 *
 * Every row is shown in the interface: value, unit and where it came from.
 */

const MARS_FACT_SHEET = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'
const NASA_M2020 = 'https://science.nasa.gov/mission/mars-2020-perseverance/'
const NASA_ROVER = 'https://mars.nasa.gov/mars2020/spacecraft/rover/'
const NASA_SPACESUITS = 'https://www.nasa.gov/humans-in-space/spacesuits/'
const NASA_APOLLO = 'https://www.nasa.gov/the-apollo-program/'
const ESTIMATE = 'Engineering estimate — docs/references.md'

const sharedAssumptions = (spacingM: number): Assumption[] => [
  {
    key: 'gravity',
    label: 'Mars gravity',
    value: '3.721',
    unit: 'm/s²',
    source: 'NASA Mars Fact Sheet',
    source_url: MARS_FACT_SHEET,
  },
  {
    key: 'spacing',
    label: 'Sample spacing',
    value: String(spacingM),
    unit: 'm',
    source: 'Model setting',
  },
]

const roverAssumptions: Assumption[] = [
  {
    key: 'mass',
    label: 'System mass',
    value: '1,025',
    unit: 'kg',
    source: 'NASA Perseverance rover',
    source_url: NASA_M2020,
  },
  {
    key: 'speed',
    label: 'Maximum speed',
    value: '4.2',
    unit: 'cm/s',
    source: 'NASA/JPL Mars 2020 rover',
    source_url: NASA_ROVER,
  },
  {
    key: 'power',
    label: 'Base electrical draw',
    value: '110',
    unit: 'W',
    source: 'MMRTG output, NASA Mars 2020',
    source_url: NASA_M2020,
  },
  {
    key: 'efficiency',
    label: 'Drivetrain efficiency',
    value: '45',
    unit: '%',
    source: ESTIMATE,
  },
  {
    key: 'slope',
    label: 'Slope limit',
    value: '20',
    unit: '°',
    source: 'Operational planning limit (hardware rated to ~30°)',
    source_url: NASA_M2020,
  },
  {
    key: 'energy',
    label: 'Energy allocation',
    value: '5,000',
    unit: 'Wh',
    source: '2-sol allocation at 110 W — engineering estimate',
  },
  {
    key: 'duration',
    label: 'Drive-time allocation',
    value: '48',
    unit: 'h',
    source: ESTIMATE,
  },
  {
    key: 'derate',
    label: 'Uphill speed derate',
    value: '55',
    unit: '% at limit',
    source: 'Model assumption',
  },
]

const humanAssumptions: Assumption[] = [
  {
    key: 'mass',
    label: 'System mass (crew + suit)',
    value: '200',
    unit: 'kg',
    source: '80 kg crew + 120 kg suit/PLSS — NASA spacesuit references (draft)',
    source_url: NASA_SPACESUITS,
  },
  {
    key: 'speed',
    label: 'Suited walk speed',
    value: '0.9',
    unit: 'm/s',
    source: 'Apollo surface-mobility analog',
    source_url: NASA_APOLLO,
  },
  {
    key: 'power',
    label: 'Suit base power',
    value: '100',
    unit: 'W',
    source: 'PLSS electrical load — engineering estimate',
    source_url: NASA_SPACESUITS,
  },
  {
    key: 'energy',
    label: 'Suit battery',
    value: '1,200',
    unit: 'Wh',
    source: '8 h excursion allocation — engineering estimate',
  },
  {
    key: 'slope',
    label: 'Slope limit',
    value: '25',
    unit: '°',
    source: 'Suited walking limit, conservative',
  },
  {
    key: 'duration',
    label: 'Excursion limit',
    value: '8',
    unit: 'h',
    source: 'Suit consumables allocation',
  },
  {
    key: 'metabolic',
    label: 'Metabolic rate, walking',
    value: '300',
    unit: 'W',
    source: 'NASA metabolic references (draft)',
    source_url: NASA_SPACESUITS,
  },
  {
    key: 'body',
    label: 'Body climb efficiency',
    value: '25',
    unit: '%',
    source: ESTIMATE,
  },
  {
    key: 'derate',
    label: 'Uphill speed derate',
    value: '60',
    unit: '% at limit',
    source: 'Model assumption',
  },
]

export const PROFILES: Record<ProfileId, ProfileSpec> = {
  rover: {
    id: 'rover',
    label: 'Rover',
    tagline: 'Perseverance-class · RTG powered',
    description:
      'Electrical ledger only. The rover drives itself; every watt comes from the RTG and the battery. Slope is the hard constraint.',
    constants: {
      systemMassKg: 1025,
      maxSpeedMps: 0.042,
      basePowerW: 110,
      driveEfficiency: 0.45,
      maxSlopeDeg: 20,
      energyBudgetWh: 5000,
      durationBudgetH: 48,
      speedDerate: 0.55,
      minSpeedFraction: 0.25,
      spacingM: 25,
    },
    assumptions: [...roverAssumptions, ...sharedAssumptions(25)],
    formula: 'E = 110 W · t + (1025 kg · 3.721 m/s² · climb) / 0.45',
  },
  human: {
    id: 'human',
    label: 'Human',
    tagline: 'Suited astronaut · 8 h excursion',
    description:
      'Two ledgers, never merged: suit electrical energy (Wh) and metabolic effort (kcal). The suit battery and the excursion clock are both hard limits.',
    constants: {
      systemMassKg: 200,
      maxSpeedMps: 0.9,
      basePowerW: 100,
      driveEfficiency: 0.25,
      maxSlopeDeg: 25,
      energyBudgetWh: 1200,
      durationBudgetH: 8,
      speedDerate: 0.6,
      minSpeedFraction: 0.35,
      spacingM: 25,
    },
    secondary: {
      label: 'Metabolic',
      basePowerW: 300,
      efficiency: 0.25,
      unit: 'kcal',
    },
    assumptions: [...humanAssumptions, ...sharedAssumptions(25)],
    formula:
      'E_suit = 100 W · t + (200 kg · 3.721 m/s² · climb) / 0.25   ·   E_met = 300 W · t + m·g·climb / 0.25 → kcal',
  },
}

export const PROFILE_IDS: ProfileId[] = ['rover', 'human']
