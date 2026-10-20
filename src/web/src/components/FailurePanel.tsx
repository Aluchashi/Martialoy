import { formatDistance, formatDuration, formatEnergy, formatDegrees } from '../lib/format'
import type { Check, ContingencyState, FailingSegment, RouteResult } from '../types'

interface Props {
  result: RouteResult
  contingency: ContingencyState
  onRequest: () => void
  onUse: () => void
  onDismiss: () => void
}

export function FailurePanel({ result, contingency, onRequest, onUse, onDismiss }: Props) {
  const failed = result.checks.filter((check) => !check.pass)
  if (failed.length === 0) return null

  const slopeCheck = failed.find((check) => check.id === 'slope')
  const segments = result.segments.slice().sort((a, b) => b.over_by_deg - a.over_by_deg)

  return (
    <section className="failure-panel" aria-label="Failure details">
      <div className="failure-head">
        <span className="eyebrow">Why it fails</span>
        <span className="failure-count">{failed.length} failed</span>
      </div>

      <ul className="failure-checks">
        {failed.map((check) => (
          <li key={check.id} className="failure-check">
            <span className="failure-dot" aria-hidden="true" />
            <div>
              <span className="failure-label">{check.label}</span>
              <span className="failure-detail">{check.detail}</span>
            </div>
            <span className="failure-value">
              {formatCheckValue(check)}
            </span>
          </li>
        ))}
      </ul>

      <div className="contingency">
        <div className="contingency-head">
          <span className="eyebrow">Contingency route</span>
          <span className="contingency-kind">Least-cost path · Dijkstra</span>
        </div>

        {result.mode === 'least_cost' ? (
          <p className="contingency-empty">
            This contingency still fails at least one check. No fully compliant path was found
            inside the search area — try a shorter traverse or a different profile.
          </p>
        ) : contingency.status === 'idle' ? (
          <>
            <p className="contingency-copy">
              Search the DEM for a detour that trades distance for slope: cost = distance + slope
              penalty, segments above {formatDegrees(result.slope_limit_deg)} are excluded.
            </p>
            <button type="button" className="btn btn-primary" onClick={onRequest}>
              Compute contingency route
            </button>
          </>
        ) : contingency.status === 'loading' ? (
          <div className="contingency-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            Searching least-cost path…
          </div>
        ) : contingency.status === 'error' ? (
          <div className="contingency-error">
            <p>{contingency.error ?? 'Could not compute a contingency route.'}</p>
            <button type="button" className="btn btn-ghost" onClick={onRequest}>
              Retry
            </button>
          </div>
        ) : contingency.result ? (
          <div className="contingency-result">
            <div className="contingency-metrics">
              <span>
                <strong>{formatDistance(contingency.result.distance_m)}</strong>
                <em>distance</em>
              </span>
              <span>
                <strong>{formatDegrees(contingency.result.max_slope_deg)}</strong>
                <em>max slope</em>
              </span>
              <span>
                <strong>{formatDuration(contingency.result.duration_s)}</strong>
                <em>traverse</em>
              </span>
              <span className={`cont-verdict ${contingency.result.pass ? 'pass' : 'fail'}`}>
                <strong>{contingency.result.pass ? 'PASS' : 'FAIL'}</strong>
                <em>verdict</em>
              </span>
            </div>
            {contingency.relaxed && (
              <p className="contingency-warning">
                No path inside the slope limit — this is a relaxed path. Treat it as advisory.
              </p>
            )}
            {contingency.result.energy_secondary && (
              <p className="contingency-sub">
                {Math.round(contingency.result.energy_secondary.value_kcal)} kcal metabolic ·{' '}
                {formatEnergy(contingency.result.energy_wh)} suit
              </p>
            )}
            <div className="contingency-actions">
              <button type="button" className="btn btn-primary" onClick={onUse}>
                Use this route
              </button>
              <button type="button" className="btn btn-ghost" onClick={onDismiss}>
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {slopeCheck && segments.length > 0 && (
        <div className="segments">
          <span className="eyebrow">Over-limit segments</span>
          <ul>
            {segments.slice(0, 3).map((segment) => (
              <SegmentRow key={`${segment.index}-${segment.start_m}`} segment={segment} limit={result.slope_limit_deg} />
            ))}
          </ul>
          {segments.length > 3 && (
            <p className="segments-more">+ {segments.length - 3} more over-limit segments</p>
          )}
        </div>
      )}
    </section>
  )
}

function SegmentRow({ segment, limit }: { segment: FailingSegment; limit: number }) {
  const direction = segment.slope_deg >= 0 ? 'uphill' : 'downhill'
  return (
    <li className="segment-row">
      <span className="segment-index">SEG {segment.index}</span>
      <span className="segment-range">
        {formatRange(segment.start_m, segment.end_m)}
      </span>
      <span className="segment-slope">
        {formatDegrees(Math.abs(segment.slope_deg))}
        <em>{direction}</em>
      </span>
      <span className="segment-over">
        +{segment.over_by_deg.toFixed(1)}° over {formatDegrees(limit)}
      </span>
    </li>
  )
}

function formatRange(start: number, end: number): string {
  if (end >= 1000) {
    return `${(start / 1000).toFixed(2)}–${(end / 1000).toFixed(2)} km`
  }
  return `${Math.round(start)}–${Math.round(end)} m`
}

function formatCheckValue(check: Check): string {
  if (check.id === 'slope') {
    return `${check.value.toFixed(1)}° / ${check.limit.toFixed(1)}°`
  }
  if (check.id === 'energy') {
    return `${formatEnergy(check.value)} / ${formatEnergy(check.limit)}`
  }
  return `${check.value.toFixed(1)} h / ${check.limit.toFixed(0)} h`
}
