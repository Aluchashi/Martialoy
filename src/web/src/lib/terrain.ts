import { REGION } from '../data/region'
import { DEG, MARS_RADIUS_M, toLocalMeters } from './geo'

/**
 * Synthetic Jezero-like terrain used ONLY by the demo engine. It exists so the
 * interface can be built and demoed before the real COG lands in cache/mars.
 * The interface labels it "DEMO TERRAIN" wherever it is used.
 *
 * Shape: a 2.8 km crater rim with one safe saddle (the gap the least-cost path
 * finds). The direct east-west traverse crosses the high rim and fails a rover
 * slope limit; a human profile (25°) just passes. Both cases are deliberate.
 */
const ORIGIN = REGION.center
const BASE_ELEVATION_M = -2630
const RIM_RADIUS_M = 1400
const RIM_SIGMA_M = 260
const SADDLE_AZIMUTH_RAD = 1.15

function wrapAngle(a: number): number {
  return ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
}

export function demoElevation(lon: number, lat: number): number {
  const [x, y] = toLocalMeters([lon, lat], ORIGIN)
  const r = Math.hypot(x, y)
  const theta = Math.atan2(y, x)

  const rimAmplitude =
    140 +
    60 * Math.cos(theta) -
    95 * Math.exp(-(wrapAngle(theta - SADDLE_AZIMUTH_RAD) ** 2) / (2 * 0.22 ** 2))

  const rim = rimAmplitude * Math.exp(-((r - RIM_RADIUS_M) ** 2) / (2 * RIM_SIGMA_M ** 2))
  const undulation = 12 * Math.sin(x / 260) + 10 * Math.cos(y / 310)
  const regionalTilt = 0.008 * x

  return BASE_ELEVATION_M + rim + undulation + regionalTilt
}

export function demoGradient(lon: number, lat: number): number {
  const d = 12
  const dLon = (d / (MARS_RADIUS_M * Math.cos(lat * DEG))) / DEG
  const dLat = (d / MARS_RADIUS_M) / DEG
  const dhx = demoElevation(lon + dLon, lat) - demoElevation(lon - dLon, lat)
  const dhy = demoElevation(lon, lat + dLat) - demoElevation(lon, lat - dLat)
  return Math.atan2(Math.hypot(dhx, dhy), 2 * d) * (180 / Math.PI)
}

export const DEMO_TERRAIN = {
  origin: ORIGIN,
  baseElevationM: BASE_ELEVATION_M,
  rimRadiusM: RIM_RADIUS_M,
  rimSigmaM: RIM_SIGMA_M,
  saddleAzimuthRad: SADDLE_AZIMUTH_RAD,
  note: 'Synthetic terrain — not NASA data. Replace with cache/mars DEM.',
}
