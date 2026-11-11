import { formatDistance, formatEnergy } from '../lib/format'
import type {
  ContingencyState,
  ProfileSpec,
  RouteResult,
} from '../types'
import { FailurePanel } from './FailurePanel'

interface Props {
  result: RouteResult | null
  profile: ProfileSpec
  busy: boolean
  error: string | null
  contingency: ContingencyState
  onTryFailing: () => void
  onTrySafe: () => void
  onRequestContingency: () => void
  onUseContingency: () => void
  onDismissContingency: () => void
  /** Render the checks list inside this card (default true). */
  showChecks?: boolean
}

export function SurvivalCard({
  result,
  profile,
  busy,
  error,
  contingency,
  onTryFailing,
  onTrySafe,
  onRequestContingency,
  onUseContingency,
  onDismissContingency,
  showChecks = true,
}: Props) {
  const limit = profile.constants.maxSlopeDeg

  return (
    <section className={`card survival-card ${busy ? 'is-busy' : ''}`} aria-label="Survival card">
      <div className="card-head">
        <span className="eyebrow">Survival card</span>
        <span className="profile-chip">
          {profile.label} · {limit.toFixed(0)}° limit
        </span>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Engine error</strong>
          <p>{error}</p>
        </div>
      )}

      {!result && !error && (
        <div className="empty-state">
          <h2>Draw a traverse</h2>
          <p>
            Add at least two vertices on the map. The engine samples the DEM every{' '}
            {profile.constants.spacingM} m, then judges the same line for a{' '}
            {profile.label.toLowerCase()}.
          </p>
          <div className="preset-actions">
            <button type="button" className="preset-btn" onClick={onTryFailing}>
              <span>Try a failing traverse</span>
              <em>Crosses the crater rim · rover exceeds 20°</em>
            </button>
            <button type="button" className="preset-btn" onClick={onTrySafe}>
              <span>Try a safe traverse</span>
              <em>Short basin route · both profiles pass</em>
            </button>
          </div>
          <p className="fineprint">
            Demo terrain until the NASA DEM is cached. The same interface reads the real COG via
            the Python engine.
          </p>
        </div>
      )}

      {result && (
        <div className="survival-body" aria-live="polite">
          <Verdict result={result} />

          <div className="metrics">
            <Metric
              label="Distance"
              {...distanceParts(result.distance_m)}
              sub={`${result.sample_count} samples · ${result.spacing_m} m`}
            />
            <Metric
              label="Traverse time"
              {...durationParts(result.duration_s)}
              sub={`${percent(result.duration_s / 3600, profile.constants.durationBudgetH)}% of ${profile.constants.durationBudgetH} h allocation`}
              state={result.checks.find((c) => c.id === 'duration')?.pass ? 'ok' : 'fail'}
            />
            <Metric
              label="Energy"
              {...energyParts(result.energy_wh)}
              sub={
                result.energy_secondary
                  ? `${Math.round(result.energy_secondary.value_kcal)} kcal ${result.energy_secondary.label.toLowerCase()}`
                  : `${percent(result.energy_wh, profile.constants.energyBudgetWh)}% of ${formatEnergy(profile.constants.energyBudgetWh)}`
              }
              state={result.checks.find((c) => c.id === 'energy')?.pass ? 'ok' : 'fail'}
            />
            <Metric
              label="Max slope"
              value={result.max_slope_deg.toFixed(1)}
              unit="°"
              sub={`limit ${result.slope_limit_deg.toFixed(0)}°`}
              state={result.checks.find((c) => c.id === 'slope')?.pass ? 'ok' : 'fail'}
            />
          </div>

          <div className="terrain-stats">
            <span>
              <em>Climb</em> <strong>{Math.round(result.climb_m).toLocaleString('en-US')} m</strong>
            </span>
            <span>
              <em>Descent</em>{' '}
              <strong>{Math.round(result.descent_m).toLocaleString('en-US')} m</strong>
            </span>
            <span>
              <em>Route</em> <strong>{result.mode === 'least_cost' ? 'Contingency' : 'Drawn'}</strong>
            </span>
          </div>

          {showChecks && <ChecksList result={result} />}

          <FailurePanel
            result={result}
            contingency={contingency}
            onRequest={onRequestContingency}
            onUse={onUseContingency}
            onDismiss={onDismissContingency}
          />

          {result.warnings.length > 0 && (
            <ul className="warnings">
              {result.warnings.map((warning) => (
                <li key={warning}>
                  <span aria-hidden="true">▲</span> {warning}
                </li>
              ))}
            </ul>
          )}

          <div className="card-meta">
            <span>{formatDistance(result.distance_m)} sampled</span>
            <span>·</span>
            <span>{result.spacing_m} m spacing</span>
            <span>·</span>
            <span>{result.pass ? 'Within limits' : 'Outside limits'}</span>
          </div>
        </div>
      )}
    </section>
  )
}

export function ChecksList({ result }: { result: RouteResult }) {
  return (
    <ul className="checks">
      {result.checks.map((check) => (
        <li key={check.id} className={check.pass ? 'pass' : 'fail'}>
          <span className="check-icon" aria-hidden="true">
            {check.pass ? '✓' : '✕'}
          </span>
          <div className="check-copy">
            <span className="check-label">{check.label}</span>
            <span className="check-detail">{check.detail}</span>
          </div>
          <span className="check-value">
            {checkValue(check.value, check.limit, check.id)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Verdict({ result }: { result: RouteResult }) {
  const failed = result.checks.filter((check) => !check.pass).length
  return (
    <div className={`verdict ${result.pass ? 'pass' : 'fail'}`}>
      <span className="verdict-mark" aria-hidden="true">
        {result.pass ? '✓' : '!'}
      </span>
      <div className="verdict-copy">
        <strong>{result.pass ? 'PASS' : 'FAIL'}</strong>
        <span>
          {result.pass
            ? 'All checks within limits'
            : `${failed} of ${result.checks.length} checks failed`}
        </span>
      </div>
      <span className="verdict-tag">{result.mode === 'least_cost' ? 'CONTINGENCY' : 'PLANNED'}</span>
    </div>
  )
}

interface MetricProps {
  label: string
  value: string
  unit: string
  sub: string
  state?: 'ok' | 'fail'
}

function Metric({ label, value, unit, sub, state }: MetricProps) {
  return (
    <div className={`metric ${state ?? ''}`}>
      <span className="m-label">{label}</span>
      <span className="m-value">
        {value}
        <span className="m-unit">{unit}</span>
      </span>
      <span className="m-sub">{sub}</span>
    </div>
  )
}

function distanceParts(meters: number): { value: string; unit: string } {
  if (meters >= 1000) return { value: (meters / 1000).toFixed(2), unit: 'km' }
  return { value: String(Math.round(meters)), unit: 'm' }
}

function durationParts(seconds: number): { value: string; unit: string } {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return { value: String(minutes), unit: 'min' }
  // "19 h 16 m" — not "19:16 h" (that reads as 19.16 hours).
  return { value: `${hours} h ${minutes.toString().padStart(2, '0')} m`, unit: '' }
}

function energyParts(wh: number): { value: string; unit: string } {
  if (wh >= 1000) return { value: (wh / 1000).toFixed(2), unit: 'kWh' }
  return { value: String(Math.round(wh)), unit: 'Wh' }
}

function percent(value: number, limit: number): number {
  return Math.round((value / limit) * 100)
}

function checkValue(value: number, limit: number, id: string): string {
  if (id === 'slope') return `${value.toFixed(1)}° / ${limit.toFixed(1)}°`
  if (id === 'energy') return `${formatEnergy(value)} / ${formatEnergy(limit)}`
  // value/limit are hours — show as "19.2 h / 48 h", matching formatDuration style
  return `${value.toFixed(1)} h / ${limit.toFixed(0)} h`
}
