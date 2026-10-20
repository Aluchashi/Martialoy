import type { LonLat, ProfileId, RouteRequest, RouteResult } from '../types'
import { buildRouteResult, demoLeastCostPath } from './demoEngine'
import type { LeastCostPath } from './demoEngine'

type Engine = 'api' | 'demo'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
let apiStatus: 'unknown' | 'up' | 'down' = 'unknown'

export function currentEngineStatus(): 'unknown' | 'up' | 'down' {
  return apiStatus
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(8000),
  })
}

export async function probeApi(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      signal: AbortSignal.timeout(1200),
    })
    apiStatus = response.ok ? 'up' : 'down'
  } catch {
    apiStatus = 'down'
  }
  return apiStatus === 'up'
}

export interface RouteResponse {
  result: RouteResult
  engine: Engine
}

export async function requestRoute(request: RouteRequest): Promise<RouteResponse> {
  if (apiStatus !== 'down') {
    try {
      const response = await apiFetch('/api/route', {
        method: 'POST',
        body: JSON.stringify(request),
      })
      if (response.ok) {
        apiStatus = 'up'
        return { result: (await response.json()) as RouteResult, engine: 'api' }
      }
      const detail = await response
        .json()
        .then((body: { detail?: string }) => body.detail)
        .catch(() => undefined)
      if (response.status >= 500) {
        // The API is up but the COG is not cached, or the engine failed. Fall
        // through to the clearly labelled demo engine instead of blocking the UI.
        apiStatus = 'down'
      } else {
        // A rejected route is a real answer, not a reason to fall back.
        throw new Error(detail ?? `Route request failed (${response.status})`)
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') apiStatus = 'down'
      else if (error instanceof TypeError) apiStatus = 'down'
      else throw error
    }
  }

  return {
    result: buildRouteResult(request.coordinates, request.profile, request.mode),
    engine: 'demo',
  }
}

export interface ContingencyResponse {
  result: RouteResult
  coordinates: LonLat[]
  relaxed: boolean
  engine: Engine
}

export async function requestContingency(
  start: LonLat,
  end: LonLat,
  profile: ProfileId,
  region: string,
): Promise<ContingencyResponse> {
  if (apiStatus !== 'down') {
    try {
      const response = await apiFetch('/api/contingency', {
        method: 'POST',
        body: JSON.stringify({ region, profile, start, end }),
      })
      if (response.ok) {
        apiStatus = 'up'
        const body = (await response.json()) as {
          result: RouteResult
          coordinates: LonLat[]
          relaxed?: boolean
        }
        return {
          result: body.result,
          coordinates: body.coordinates,
          relaxed: body.relaxed ?? false,
          engine: 'api',
        }
      }
      if (response.status === 503) {
        apiStatus = 'down'
      } else if (response.status >= 400 && response.status < 500) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string }
        throw new Error(body.detail ?? 'No contingency route available')
      } else {
        apiStatus = 'down'
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') apiStatus = 'down'
      else if (error instanceof TypeError) apiStatus = 'down'
      else throw error
    }
  }

  const path: LeastCostPath = demoLeastCostPath(start, end, profile)
  return {
    result: buildRouteResult(path.coordinates, profile, 'least_cost'),
    coordinates: path.coordinates,
    relaxed: path.relaxed,
    engine: 'demo',
  }
}
