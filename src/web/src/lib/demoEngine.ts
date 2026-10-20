import { PROFILES } from '../data/profiles'
import { REGION } from '../data/region'
import type {
  Check,
  FailingSegment,
  LonLat,
  ProfileId,
  RouteMode,
  RouteResult,
  RouteSample,
} from '../types'
import { MARS_GRAVITY, clamp, fromLocalMeters, samplePolyline, toLocalMeters } from './geo'
import { demoElevation } from './terrain'

const RAD = 180 / Math.PI
const KCAL_PER_WH = 0.860421
const GRID_RESOLUTION_M = 30
const MAX_GRID_CELLS = 240
const SLOPE_COST_WEIGHT = 6

/**
 * Demo implementation of the route engine. It follows the same contract and
 * formulas as src/compute/route.py so the UI can be wired to the real backend
 * without changing components.
 */
export function buildRouteResult(
  points: LonLat[],
  profileId: ProfileId,
  mode: RouteMode = 'drawn',
): RouteResult {
  const profile = PROFILES[profileId]
  const c = profile.constants
  const spaced = samplePolyline(points, c.spacingM)

  const elevations = spaced.map((p) => demoElevation(p.lon, p.lat))
  const samples: RouteSample[] = []
  const segments: FailingSegment[] = []

  let climb = 0
  let descent = 0
  let duration = 0
  let maxSlope = 0
  let minSlope = 0

  for (let i = 0; i < spaced.length; i++) {
    const p = spaced[i]
    let slope = 0
    if (i > 0) {
      const ds = p.distance_m - spaced[i - 1].distance_m
      const dh = elevations[i] - elevations[i - 1]
      slope = ds > 0.001 ? Math.atan2(dh, ds) * RAD : 0

      if (dh > 0) climb += dh
      else descent += -dh

      const uphill = Math.max(slope, 0)
      const speedFactor = clamp(
        1 - c.speedDerate * (uphill / c.maxSlopeDeg),
        c.minSpeedFraction,
        1,
      )
      duration += ds / (c.maxSpeedMps * speedFactor)
    }

    const over = Math.abs(slope) > c.maxSlopeDeg
    if (over) {
      const segment: FailingSegment = {
        index: i,
        start_m: i > 0 ? spaced[i - 1].distance_m : p.distance_m,
        end_m: p.distance_m,
        lon: p.lon,
        lat: p.lat,
        slope_deg: slope,
        over_by_deg: Math.abs(slope) - c.maxSlopeDeg,
      }
      segments.push(segment)
      samples.push({
        distance_m: p.distance_m,
        lon: p.lon,
        lat: p.lat,
        elevation_m: elevations[i],
        slope_deg: slope,
        over_limit: true,
      })
    } else {
      samples.push({
        distance_m: p.distance_m,
        lon: p.lon,
        lat: p.lat,
        elevation_m: elevations[i],
        slope_deg: slope,
        over_limit: false,
      })
    }

    maxSlope = Math.max(maxSlope, Math.abs(slope))
    minSlope = Math.min(minSlope, slope)
  }

  const distance = spaced.length ? spaced[spaced.length - 1].distance_m : 0
  const energyWh =
    c.basePowerW * (duration / 3600) + (c.systemMassKg * MARS_GRAVITY * climb) / (c.driveEfficiency * 3600)

  const durationH = duration / 3600
  const slopePass = segments.length === 0
  const energyPass = energyWh <= c.energyBudgetWh
  const durationPass = durationH <= c.durationBudgetH

  const worst = segments.reduce<FailingSegment | null>(
    (acc, s) => (acc === null || s.over_by_deg > acc.over_by_deg ? s : acc),
    null,
  )

  const checks: Check[] = [
    {
      id: 'slope',
      label: 'Slope limit',
      value: round(maxSlope, 1),
      limit: c.maxSlopeDeg,
      unit: '°',
      pass: slopePass,
      detail: slopePass
        ? `Every ${c.spacingM} m segment is at or below ${c.maxSlopeDeg.toFixed(1)}°`
        : `${segments.length} segment${segments.length === 1 ? '' : 's'} over limit · worst +${round(worst?.over_by_deg ?? 0, 1)}° at ${(worst?.start_m ?? 0) / 1000 > 0 ? ((worst?.start_m ?? 0) / 1000).toFixed(2) : '0.00'} km`,
    },
    {
      id: 'energy',
      label: 'Energy allocation',
      value: round(energyWh, 1),
      limit: c.energyBudgetWh,
      unit: 'Wh',
      pass: energyPass,
      detail: `${round((energyWh / c.energyBudgetWh) * 100, 0)}% of the ${c.energyBudgetWh.toLocaleString('en-US')} Wh allocation`,
    },
    {
      id: 'duration',
      label: 'Time allocation',
      value: round(durationH, 2),
      limit: c.durationBudgetH,
      unit: 'h',
      pass: durationPass,
      detail: `${round((durationH / c.durationBudgetH) * 100, 0)}% of the ${c.durationBudgetH} h allocation`,
    },
  ]

  const warnings: string[] = []
  if (slopePass && maxSlope > c.maxSlopeDeg - 1.5) {
    warnings.push(`Slope margin is only ${round(c.maxSlopeDeg - maxSlope, 1)}°.`)
  }
  if (energyPass && energyWh > c.energyBudgetWh * 0.8) {
    warnings.push(`Energy uses ${round((energyWh / c.energyBudgetWh) * 100, 0)}% of the allocation.`)
  }
  if (durationPass && durationH > c.durationBudgetH * 0.8) {
    warnings.push(`Duration uses ${round((durationH / c.durationBudgetH) * 100, 0)}% of the allocation.`)
  }
  if (mode === 'least_cost' && !slopePass) {
    warnings.push('No path within the slope limit was found; the path is relaxed.')
  }

  const pass = slopePass && energyPass && durationPass

  return {
    profile: profileId,
    mode,
    distance_m: distance,
    climb_m: climb,
    descent_m: descent,
    duration_s: duration,
    energy_wh: energyWh,
    energy_secondary: profile.secondary
      ? {
          label: profile.secondary.label,
          value_kcal:
            (profile.secondary.basePowerW * (duration / 3600) +
              (c.systemMassKg * MARS_GRAVITY * climb) / (profile.secondary.efficiency * 3600)) *
            KCAL_PER_WH,
        }
      : undefined,
    max_slope_deg: maxSlope,
    min_slope_deg: minSlope,
    slope_limit_deg: c.maxSlopeDeg,
    pass,
    spacing_m: c.spacingM,
    sample_count: samples.length,
    samples,
    segments,
    checks,
    assumptions: profile.assumptions,
    warnings,
    contingency: {
      available: !pass && mode === 'drawn',
      reason: !pass && mode === 'drawn' ? 'Least-cost detour can be computed' : undefined,
    },
  }
}

export interface LeastCostPath {
  coordinates: LonLat[]
  relaxed: boolean
  cells: number
  resolution_m: number
}

/**
 * Demo least-cost path: Dijkstra over a 30 m grid of the synthetic terrain.
 * Edge cost = ds * (1 + k * (slope/limit)^2), edges above the limit are blocked.
 * The real implementation in src/compute/graph.py does the same over the COG.
 */
export function demoLeastCostPath(
  start: LonLat,
  end: LonLat,
  profileId: ProfileId,
): LeastCostPath {
  const limit = PROFILES[profileId].constants.maxSlopeDeg
  const origin = REGION.center
  const [sx, sy] = toLocalMeters(start, origin)
  const [ex, ey] = toLocalMeters(end, origin)

  const pad = 1000
  const minX = Math.min(sx, ex) - pad
  const maxX = Math.max(sx, ex) + pad
  const minY = Math.min(sy, ey) - pad
  const maxY = Math.max(sy, ey) + pad

  let resolution = GRID_RESOLUTION_M
  let nx = Math.ceil((maxX - minX) / resolution) + 1
  let ny = Math.ceil((maxY - minY) / resolution) + 1
  if (nx > MAX_GRID_CELLS || ny > MAX_GRID_CELLS) {
    resolution = Math.max(maxX - minX, maxY - minY) / (MAX_GRID_CELLS - 1)
    nx = Math.ceil((maxX - minX) / resolution) + 1
    ny = Math.ceil((maxY - minY) / resolution) + 1
  }
  nx = Math.max(3, nx)
  ny = Math.max(3, ny)

  const heights = new Float64Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [lon, lat] = fromLocalMeters(minX + i * resolution, minY + j * resolution, origin)
      heights[j * nx + i] = demoElevation(lon, lat)
    }
  }

  const startIdx = clamp(Math.round((sx - minX) / resolution), 0, nx - 1) +
    clamp(Math.round((sy - minY) / resolution), 0, ny - 1) * nx
  const endIdx = clamp(Math.round((ex - minX) / resolution), 0, nx - 1) +
    clamp(Math.round((ey - minY) / resolution), 0, ny - 1) * nx

  const search = (blockOverLimit: boolean): { reached: boolean; prev: Int32Array } => {
    const count = nx * ny
    const dist = new Float64Array(count).fill(Infinity)
    const prev = new Int32Array(count).fill(-1)
    const settled = new Uint8Array(count)
    const heap: number[] = []

    const less = (a: number, b: number) => dist[a] < dist[b]
    const swap = (a: number, b: number) => {
      const t = heap[a]
      heap[a] = heap[b]
      heap[b] = t
    }
    const push = (idx: number) => {
      heap.push(idx)
      let i = heap.length - 1
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (!less(heap[i], heap[parent])) break
        swap(i, parent)
        i = parent
      }
    }
    const pop = (): number => {
      const top = heap[0]
      const last = heap.pop() as number
      if (heap.length > 0) {
        heap[0] = last
        let i = 0
        for (;;) {
          const l = i * 2 + 1
          const r = l + 1
          let smallest = i
          if (l < heap.length && less(heap[l], heap[smallest])) smallest = l
          if (r < heap.length && less(heap[r], heap[smallest])) smallest = r
          if (smallest === i) break
          swap(i, smallest)
          i = smallest
        }
      }
      return top
    }

    dist[startIdx] = 0
    push(startIdx)

    while (heap.length > 0) {
      const cur = pop()
      if (settled[cur]) continue
      settled[cur] = 1
      if (cur === endIdx) break

      const ci = cur % nx
      const cj = Math.floor(cur / nx)
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue
          const ni = ci + di
          const nj = cj + dj
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue
          const next = nj * nx + ni
          if (settled[next]) continue

          const ds = resolution * Math.hypot(di, dj)
          const slope = Math.atan2(heights[next] - heights[cur], ds) * RAD
          if (blockOverLimit && Math.abs(slope) > limit) continue

          const penalty = 1 + SLOPE_COST_WEIGHT * (Math.abs(slope) / limit) ** 2
          const candidate = dist[cur] + ds * penalty
          if (candidate < dist[next]) {
            dist[next] = candidate
            prev[next] = cur
            push(next)
          }
        }
      }
    }

    return { reached: Number.isFinite(dist[endIdx]), prev }
  }

  let result = search(true)
  let relaxed = false
  if (!result.reached) {
    result = search(false)
    relaxed = true
  }

  const indices: number[] = []
  let cursor = endIdx
  while (cursor !== -1 && indices.length <= nx * ny) {
    indices.push(cursor)
    if (cursor === startIdx) break
    cursor = result.prev[cursor]
  }
  indices.reverse()

  const coordinates: LonLat[] = []
  if (indices.length === 0 || indices[0] !== startIdx) {
    coordinates.push(start)
  }
  for (const idx of indices) {
    const i = idx % nx
    const j = Math.floor(idx / nx)
    coordinates.push(fromLocalMeters(minX + i * resolution, minY + j * resolution, origin))
  }
  // Keep every second grid node so the drawn line is lighter but still faithful.
  const thinned = coordinates.filter((_, i) => i % 2 === 0 || i === coordinates.length - 1)
  thinned[0] = start
  thinned.push(end)

  return {
    coordinates: dedupe(thinned),
    relaxed,
    cells: nx * ny,
    resolution_m: resolution,
  }
}

export const PRESET_FAILING: LonLat[] = [
  [77.58, 18.44],
  [77.62, 18.44],
]

export const PRESET_SAFE: LonLat[] = [
  [77.575, 18.437],
  [77.5805, 18.4405],
  [77.585, 18.4385],
]

export const PRESET_CONTOUR: LonLat[] = [
  [77.58, 18.44],
  [77.5902, 18.4616],
  [77.6018, 18.4635],
  [77.6136, 18.4535],
  [77.62, 18.4419],
  [77.62, 18.44],
]

function round(value: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

function dedupe(points: LonLat[]): LonLat[] {
  const out: LonLat[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) {
      out.push(p)
    }
  }
  return out
}
