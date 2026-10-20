import type { LonLat } from '../types'

/** Mars is treated as a sphere for all horizontal maths (documented assumption). */
export const MARS_RADIUS_M = 3_389_500
export const MARS_GRAVITY = 3.721
export const DEG = Math.PI / 180

const RAD = 180 / Math.PI

export function haversineMeters(a: LonLat, b: LonLat): number {
  const dLat = (b[1] - a[1]) * DEG
  const dLon = (b[0] - a[0]) * DEG
  const lat1 = a[1] * DEG
  const lat2 = b[1] * DEG
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Local east/north metres around an origin. Equirectangular, fine at Jezero scale. */
export function toLocalMeters(p: LonLat, origin: LonLat): [number, number] {
  const x = (p[0] - origin[0]) * DEG * MARS_RADIUS_M * Math.cos(origin[1] * DEG)
  const y = (p[1] - origin[1]) * DEG * MARS_RADIUS_M
  return [x, y]
}

export function fromLocalMeters(x: number, y: number, origin: LonLat): LonLat {
  const lon = origin[0] + (x / (MARS_RADIUS_M * Math.cos(origin[1] * DEG))) * RAD
  const lat = origin[1] + (y / MARS_RADIUS_M) * RAD
  return [lon, lat]
}

export interface SampledPoint {
  lon: number
  lat: number
  distance_m: number
}

/**
 * Resample a polyline at a fixed arc-length spacing. Vertex interpolation is
 * linear in lon/lat, which is exact enough at the 10 km scale of one region.
 */
export function samplePolyline(points: LonLat[], spacingM: number): SampledPoint[] {
  if (points.length < 2) return []

  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const len = haversineMeters(points[i], points[i + 1])
    lengths.push(len)
    total += len
  }
  if (total < 0.5) return [{ lon: points[0][0], lat: points[0][1], distance_m: 0 }]

  const steps = Math.max(1, Math.floor(total / spacingM))
  const step = total / steps
  const out: SampledPoint[] = []

  let seg = 0
  let segStart = 0
  for (let k = 0; k <= steps; k++) {
    const target = k * step
    while (seg < lengths.length - 1 && segStart + lengths[seg] < target - 1e-6) {
      segStart += lengths[seg]
      seg++
    }
    const a = points[seg]
    const b = points[seg + 1]
    const t = lengths[seg] > 0 ? Math.min(1, Math.max(0, (target - segStart) / lengths[seg])) : 0
    out.push({
      lon: a[0] + (b[0] - a[0]) * t,
      lat: a[1] + (b[1] - a[1]) * t,
      distance_m: target,
    })
  }

  // Guarantee the drawn endpoint is represented even if the last step is short.
  const last = points[points.length - 1]
  const tail = out[out.length - 1]
  if (tail && haversineMeters([tail.lon, tail.lat], last) > 0.5) {
    out.push({ lon: last[0], lat: last[1], distance_m: total })
  }
  return out
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
