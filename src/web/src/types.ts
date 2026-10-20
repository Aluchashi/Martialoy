export type LonLat = [number, number]

export type ProfileId = 'rover' | 'human'

export type RouteMode = 'drawn' | 'least_cost'

export interface RouteSample {
  distance_m: number
  lon: number
  lat: number
  elevation_m: number
  /** Signed slope in degrees along the segment ending at this sample. */
  slope_deg: number
  /** True when |slope_deg| exceeds the profile slope limit. */
  over_limit: boolean
  /** True when the DEM had no data at this sample (slope is not inferred). */
  gap?: boolean
}

export interface FailingSegment {
  index: number
  start_m: number
  end_m: number
  lon: number
  lat: number
  slope_deg: number
  over_by_deg: number
}

export interface Check {
  id: 'slope' | 'energy' | 'duration'
  label: string
  value: number
  limit: number
  unit: string
  pass: boolean
  detail: string
}

export interface Assumption {
  key: string
  label: string
  value: string
  unit?: string
  source: string
  source_url?: string
}

export interface EnergyLedger {
  label: string
  value_kcal: number
}

export interface ContingencyInfo {
  available: boolean
  reason?: string
}

export interface RouteResult {
  profile: ProfileId
  mode: RouteMode
  distance_m: number
  climb_m: number
  descent_m: number
  duration_s: number
  energy_wh: number
  energy_secondary?: EnergyLedger
  max_slope_deg: number
  min_slope_deg: number
  slope_limit_deg: number
  pass: boolean
  spacing_m: number
  sample_count: number
  samples: RouteSample[]
  segments: FailingSegment[]
  checks: Check[]
  assumptions: Assumption[]
  warnings: string[]
  contingency: ContingencyInfo
}

export interface ContingencyState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  result?: RouteResult
  relaxed?: boolean
  error?: string
}

export interface RouteRequest {
  region: string
  profile: ProfileId
  spacing_m: number
  mode: RouteMode
  coordinates: LonLat[]
}

export interface ProfileConstants {
  systemMassKg: number
  maxSpeedMps: number
  basePowerW: number
  driveEfficiency: number
  maxSlopeDeg: number
  energyBudgetWh: number
  durationBudgetH: number
  speedDerate: number
  minSpeedFraction: number
  spacingM: number
}

export interface SecondaryLedgerSpec {
  label: string
  basePowerW: number
  efficiency: number
  unit: 'kcal'
}

export interface ProfileSpec {
  id: ProfileId
  label: string
  tagline: string
  description: string
  constants: ProfileConstants
  secondary?: SecondaryLedgerSpec
  assumptions: Assumption[]
  formula: string
}

export interface RegionSpec {
  id: string
  label: string
  center: LonLat
  bbox: [number, number, number, number]
}
