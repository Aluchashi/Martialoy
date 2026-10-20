import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Assumptions } from './components/Assumptions'
import { ElevationProfile } from './components/ElevationProfile'
import { Header } from './components/Header'
import { MapView } from './components/MapView'
import { SiteFooter } from './components/SiteFooter'
import { SurvivalCard } from './components/SurvivalCard'
import { PROFILES } from './data/profiles'
import { REGION } from './data/region'
import { PRESET_FAILING, PRESET_SAFE } from './lib/demoEngine'
import { probeApi, requestContingency, requestRoute } from './lib/api'
import type {
  ContingencyState,
  LonLat,
  ProfileId,
  RouteResult,
  RouteSample,
} from './types'

const MAX_VERTICES = 40

export default function App() {
  const [profile, setProfile] = useState<ProfileId>('rover')
  const [points, setPoints] = useState<LonLat[]>([])
  const [result, setResult] = useState<RouteResult | null>(null)
  const [engine, setEngine] = useState<'api' | 'demo'>('demo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<RouteSample | null>(null)
  const [contingency, setContingency] = useState<ContingencyState>({ status: 'idle' })
  const [contingencyPath, setContingencyPath] = useState<LonLat[] | null>(null)
  const [fitNonce, setFitNonce] = useState(0)
  const sidebarRef = useRef<HTMLElement>(null)

  const profileSpec = useMemo(() => PROFILES[profile], [profile])

  const scrollSidebarTop = useCallback(() => {
    sidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const changeProfile = useCallback(
    (next: ProfileId) => {
      setProfile(next)
      scrollSidebarTop()
    },
    [scrollSidebarTop],
  )

  const undo = useCallback(() => {
    setPoints((current) => current.slice(0, -1))
  }, [])

  const clear = useCallback(() => {
    setPoints([])
  }, [])

  const addPoint = useCallback((point: LonLat) => {
    setPoints((current) => (current.length >= MAX_VERTICES ? current : [...current, point]))
  }, [])

  useEffect(() => {
    void probeApi()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'Backspace') {
        event.preventDefault()
        undo()
      } else if (event.key === 'Escape') {
        clear()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, clear])

  useEffect(() => {
    setContingency({ status: 'idle' })
    setContingencyPath(null)
    setHover(null)
  }, [points, profile])

  useEffect(() => {
    if (points.length < 2) {
      setResult(null)
      setBusy(false)
      setError(null)
      return
    }

    let cancelled = false
    setBusy(true)
    setError(null)

    const timer = window.setTimeout(() => {
      requestRoute({
        region: REGION.id,
        profile,
        spacing_m: profileSpec.constants.spacingM,
        mode: 'drawn',
        coordinates: points,
      })
        .then((response) => {
          if (cancelled) return
          setResult(response.result)
          setEngine(response.engine)
        })
        .catch((cause: unknown) => {
          if (cancelled) return
          setResult(null)
          setError(cause instanceof Error ? cause.message : 'Route computation failed')
        })
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 140)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [points, profile, profileSpec.constants.spacingM])

  const requestContingencyRoute = useCallback(async () => {
    if (points.length < 2) return
    setContingency({ status: 'loading' })
    try {
      const response = await requestContingency(
        points[0],
        points[points.length - 1],
        profile,
        REGION.id,
      )
      setContingency({
        status: 'ready',
        result: response.result,
        relaxed: response.relaxed,
      })
      setContingencyPath(response.coordinates)
      setEngine(response.engine)
      setFitNonce((nonce) => nonce + 1)
      scrollSidebarTop()
    } catch (cause) {
      setContingency({
        status: 'error',
        error: cause instanceof Error ? cause.message : 'Contingency search failed',
      })
    }
  }, [points, profile, scrollSidebarTop])

  const loadPreset = useCallback(
    (preset: LonLat[]) => {
      setPoints(preset)
      setFitNonce((nonce) => nonce + 1)
      scrollSidebarTop()
    },
    [scrollSidebarTop],
  )

  const useContingency = useCallback(() => {
    if (!contingencyPath) return
    setPoints(contingencyPath)
    setFitNonce((nonce) => nonce + 1)
    setContingency({ status: 'idle' })
    setContingencyPath(null)
    scrollSidebarTop()
  }, [contingencyPath, scrollSidebarTop])

  const dismissContingency = useCallback(() => {
    setContingency({ status: 'idle' })
    setContingencyPath(null)
  }, [])

  return (
    <div className="app">
      <Header profile={profile} onProfileChange={changeProfile} engine={engine} />

      <main className="layout">
        <MapView
          points={points}
          result={result}
          contingency={contingencyPath}
          hover={hover}
          fitNonce={fitNonce}
          onAddPoint={addPoint}
          onUndo={undo}
          onClear={clear}
        />

        <aside className="sidebar" ref={sidebarRef}>
          <SurvivalCard
            result={result}
            profile={profileSpec}
            busy={busy}
            error={error}
            contingency={contingency}
            onTryFailing={() => loadPreset(PRESET_FAILING)}
            onTrySafe={() => loadPreset(PRESET_SAFE)}
            onRequestContingency={() => void requestContingencyRoute()}
            onUseContingency={useContingency}
            onDismissContingency={dismissContingency}
          />
          <Assumptions
            profile={profileSpec}
            assumptionOverride={result?.profile === profile ? result.assumptions : undefined}
          />
        </aside>

        <ElevationProfile result={result} onHover={setHover} />
      </main>

      <SiteFooter />
    </div>
  )
}
