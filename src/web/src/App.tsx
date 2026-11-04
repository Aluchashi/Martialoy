import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Assumptions } from './components/Assumptions'
import { ElevationProfile } from './components/ElevationProfile'
import { Header } from './components/Header'
import { LandingPage } from './components/LandingPage'
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
import { formatDistance, formatDuration, formatEnergy, formatDegrees } from './lib/format'

type Page = 'home' | 'route' | 'calculation' | 'survival'

function readPage(): Page {
  const value = window.location.hash.slice(1)
  return value === 'route' || value === 'calculation' || value === 'survival' ? value : 'home'
}

const MAX_VERTICES = 40

export default function App() {
  const [page, setPage] = useState<Page>(readPage)
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

  useEffect(() => {
    const syncPage = () => setPage(readPage())
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

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
      {page === 'home' ? (
        <LandingPage />
      ) : (
        <>
          <Header profile={profile} onProfileChange={changeProfile} engine={engine} page={page} />
          {page === 'route' && (
            <main className="page-shell">
              <section className="page-intro">
                <div><p className="eyebrow">STEP 1 / ROUTE SELECTION</p><h1>Plan your <span>Mars traverse.</span></h1></div>
                <p className="intro-note">Choose an explorer above, then click the map to add route points. Double-click to finish.</p>
              </section>
              <section className="layout route-layout">
                <MapView points={points} result={result} contingency={contingencyPath} hover={hover} fitNonce={fitNonce} onAddPoint={addPoint} onUndo={undo} onClear={clear} />
                <aside className="route-assumptions"><Assumptions profile={profileSpec} assumptionOverride={result?.profile === profile ? result.assumptions : undefined} /></aside>
              </section>
              <div className="step-actions route-step-actions"><span className="engine-note">{points.length < 2 ? 'Add at least two points to create a route.' : busy ? 'Calculating this route…' : `${points.length} route points selected`}</span><a className="button button-primary" href="#calculation">Continue to calculation →</a></div>
            </main>
          )}
          {page === 'calculation' && (
            <main className="page-shell">
              <section className="page-intro"><div><p className="eyebrow">STEP 2 / CALCULATION</p><h1>Route numbers,<br /><span>all in one place.</span></h1></div><p className="intro-note">Results use the selected route and {profileSpec.label.toLowerCase()} profile.</p></section>
              <section className="summary-strip panel">
                <div><span className="summary-label">SELECTED EXPLORER</span><strong>{profileSpec.label}</strong></div>
                <div><span className="summary-label">REGION</span><strong>{REGION.label}</strong></div>
                <div><span className="summary-label">ROUTE POINTS</span><strong>{points.length}</strong></div>
                <a className="text-link" href="#route">Edit route ↗</a>
              </section>
              {error && <div className="error-banner" role="alert"><strong>Calculation unavailable</strong><p>{error}</p></div>}
              <section className="metrics-grid" aria-label="Route calculation results">
                <CalculationMetric icon="↔" label="Total distance" value={result ? formatDistance(result.distance_m) : '—'} pending={busy ? 'Calculating route' : 'Waiting for a route'} />
                <CalculationMetric icon="∠" label="Maximum slope" value={result ? formatDegrees(result.max_slope_deg) : '—'} pending={busy ? 'Sampling terrain' : 'Waiting for terrain data'} />
                <CalculationMetric icon="◷" label="Travel time" value={result ? formatDuration(result.duration_s) : '—'} pending={busy ? 'Calculating route' : 'Waiting for a route'} />
              </section>
              <section className="panel energy-panel">
                <div className="panel-title"><div><p className="eyebrow">ENERGY ESTIMATE</p><h2>Separate energy ledgers</h2></div><span className="region-badge">{result ? 'Computed from selected route' : 'No values calculated yet'}</span></div>
                {profile === 'rover' ? <EnergyLedger label="Rover electrical energy" detail="Electrical consumption for the traverse" value={result ? formatEnergy(result.energy_wh) : '— Wh'} /> : <><EnergyLedger label="Human suit electrical energy" detail="Suit and life-support electrical consumption" value={result ? formatEnergy(result.energy_wh) : '— Wh'} /><EnergyLedger label="Human metabolic energy" detail="Estimated human effort for the traverse" value={result?.energy_secondary ? `${Math.round(result.energy_secondary.value_kcal).toLocaleString()} kcal` : '— kcal'} /></>}
                {!result && <p className="placeholder-note">{busy ? 'Route engine is calculating.' : 'Draw at least two map points to calculate these values.'}</p>}
                {result && <p className="placeholder-note">Elevation gain: {Math.round(result.climb_m).toLocaleString()} m · Sample spacing: {result.spacing_m} m</p>}
              </section>
              <div className="step-actions"><a className="button button-secondary" href="#route">← Back to route</a><a className="button button-primary" href="#survival">View survival card →</a></div>
            </main>
          )}
          {page === 'survival' && (
            <main className="page-shell">
              <section className="page-intro"><div><p className="eyebrow">STEP 3 / SURVIVAL CARD</p><h1>Check the <span>journey.</span></h1></div><p className="intro-note">Review limits, terrain samples and any failing route segments.</p></section>
              <section className="survival-page-layout">
                <div className="survival-page-main">
                  <SurvivalCard result={result} profile={profileSpec} busy={busy} error={error} contingency={contingency} onTryFailing={() => loadPreset(PRESET_FAILING)} onTrySafe={() => loadPreset(PRESET_SAFE)} onRequestContingency={() => void requestContingencyRoute()} onUseContingency={useContingency} onDismissContingency={dismissContingency} />
                  <ElevationProfile result={result} onHover={setHover} />
                </div>
              </section>
              <div className="step-actions"><a className="button button-secondary" href="#calculation">← Back to calculation</a><a className="button button-primary" href="#route">Edit route →</a></div>
            </main>
          )}
          <SiteFooter />
        </>
      )}
    </div>
  )
}

function CalculationMetric({ icon, label, value, pending }: { icon: string; label: string; value: string; pending: string }) {
  return <article className="metric-card"><span className="metric-icon">{icon}</span><p className="metric-label">{label}</p><strong>{value}</strong><span className="metric-state">{value === '—' ? pending : 'From selected route'}</span></article>
}

function EnergyLedger({ label, detail, value }: { label: string; detail: string; value: string }) {
  return <div className="energy-ledger"><span className="ledger-symbol">⚡</span><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>
}
