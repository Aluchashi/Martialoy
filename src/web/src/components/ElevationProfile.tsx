import { useEffect, useMemo, useRef, useState } from 'react'
import type { RouteResult, RouteSample } from '../types'
import { clamp } from '../lib/geo'
import { formatDegrees, formatDistance } from '../lib/format'

const FALLBACK_HEIGHT = 250
const M = { top: 16, right: 18, bottom: 26, left: 56 }

interface Props {
  result: RouteResult | null
  onHover: (sample: RouteSample | null) => void
}

export function ElevationProfile({ result, onHover }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(760)
  const [height, setHeight] = useState(FALLBACK_HEIGHT)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    const element = bodyRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect?.width) setWidth(Math.max(320, rect.width))
      if (rect?.height) setHeight(Math.max(200, Math.round(rect.height)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Belt-and-braces: measure once when a result arrives (the panel may have
  // been laid out before the SVG was mounted, so the observer can miss it).
  useEffect(() => {
    const element = bodyRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    if (rect.height) setHeight(Math.max(200, Math.round(rect.height)))
  }, [result])

  const plotWidth = Math.max(120, width - M.left - M.right)
  const plotHeight = height - M.top - M.bottom

  const chart = useMemo(() => {
    if (!result || result.samples.length < 2) return null
    const samples = result.samples
    const dMax = Math.max(result.distance_m, 1)
    let lo = Math.min(...samples.map((s) => s.elevation_m))
    let hi = Math.max(...samples.map((s) => s.elevation_m))
    const pad = Math.max(8, (hi - lo) * 0.12)
    lo -= pad
    hi += pad
    if (hi - lo < 1) {
      hi += 10
      lo -= 10
    }

    const x = (d: number) => M.left + (d / dMax) * plotWidth
    const y = (e: number) => M.top + (1 - (e - lo) / (hi - lo)) * plotHeight
    const bottom = M.top + plotHeight

    let path = ''
    for (let i = 0; i < samples.length; i++) {
      path += `${i === 0 ? 'M' : 'L'}${x(samples[i].distance_m).toFixed(2)} ${y(samples[i].elevation_m).toFixed(2)}`
    }
    const area = `${path} L${x(samples[samples.length - 1].distance_m).toFixed(2)} ${bottom} L${x(0).toFixed(2)} ${bottom} Z`

    const overSpans: { x: number; w: number }[] = []
    const overLines: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let i = 1; i < samples.length; i++) {
      if (!samples[i].over_limit) continue
      const x1 = x(samples[i - 1].distance_m)
      const x2 = x(samples[i].distance_m)
      overSpans.push({ x: x1, w: Math.max(1.5, x2 - x1) })
      overLines.push({
        x1,
        y1: y(samples[i - 1].elevation_m),
        x2,
        y2: y(samples[i].elevation_m),
      })
    }

    const yTicks = Array.from({ length: 4 }, (_, i) => lo + ((hi - lo) * i) / 3)
    const xTicks = Array.from({ length: 5 }, (_, i) => (dMax * i) / 4)

    return { samples, dMax, lo, hi, x, y, bottom, path, area, overSpans, overLines, yTicks, xTicks }
  }, [result, plotWidth, plotHeight])

  const hovered = chart && hoverIndex !== null ? chart.samples[hoverIndex] : null

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!chart) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const distance = clamp(((px - M.left) / plotWidth) * chart.dMax, 0, chart.dMax)

    let lo = 0
    let hi = chart.samples.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (chart.samples[mid].distance_m < distance) lo = mid
      else hi = mid
    }
    const chosen =
      Math.abs(chart.samples[lo].distance_m - distance) <=
      Math.abs(chart.samples[hi].distance_m - distance)
        ? lo
        : hi
    setHoverIndex(chosen)
    onHover(chart.samples[chosen])
  }

  function handleLeave() {
    setHoverIndex(null)
    onHover(null)
  }

  const summary = result
    ? `${formatDistance(result.distance_m)} · ${Math.round(result.climb_m)} m climb · max ${formatDegrees(result.max_slope_deg)}`
    : 'Draw a route to sample the DEM'

  return (
    <section className="chart-panel" aria-label="Elevation profile">
      <div className="chart-head">
        <div className="chart-title">
          <span className="eyebrow">Elevation profile</span>
          <span className="chart-summary">{summary}</span>
        </div>
        {result && (
          <div className="chart-legend">
            <span className="legend-swatch terrain" /> Terrain
            <span className="legend-swatch hazard" /> Over {result.slope_limit_deg}°
            <span className="chart-spacing">{result.spacing_m} m sampling</span>
          </div>
        )}
      </div>

      <div className="chart-body" ref={bodyRef}>
        {!result || !chart ? (
          <div className="chart-empty">
            <div className="empty-grid" />
            <p>
              <strong>No profile yet.</strong> Add at least two vertices to see slope, climb and
              energy.
            </p>
          </div>
        ) : (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`Elevation profile over ${formatDistance(result.distance_m)}, maximum slope ${formatDegrees(result.max_slope_deg)}`}
              onPointerMove={handleMove}
              onPointerLeave={handleLeave}
            >
              <title>Elevation profile</title>
              <defs>
                <linearGradient id="terrain-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e0653a" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#e0653a" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {chart.yTicks.map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    x1={M.left}
                    x2={M.left + plotWidth}
                    y1={chart.y(tick)}
                    y2={chart.y(tick)}
                    className="chart-grid"
                  />
                  <text x={M.left - 10} y={chart.y(tick) + 3.5} className="chart-axis" textAnchor="end">
                    {Math.round(tick).toLocaleString('en-US')} m
                  </text>
                </g>
              ))}

              {chart.xTicks.map((tick) => (
                <g key={`x-${tick}`}>
                  <line
                    x1={chart.x(tick)}
                    x2={chart.x(tick)}
                    y1={M.top}
                    y2={chart.bottom}
                    className="chart-grid vertical"
                  />
                  <text
                    x={chart.x(tick)}
                    y={height - 8}
                    className="chart-axis"
                    textAnchor="middle"
                  >
                    {tick === 0 ? '0 km' : `${(tick / 1000).toFixed(1)} km`}
                  </text>
                </g>
              ))}

              {chart.overSpans.map((span, index) => (
                <rect
                  key={`span-${index}`}
                  x={span.x}
                  y={M.top}
                  width={span.w}
                  height={plotHeight}
                  className="chart-over-span"
                />
              ))}

              <path d={chart.area} fill="url(#terrain-fill)" />
              <path d={chart.path} className="chart-line" />
              {chart.overLines.map((line, index) => (
                <line
                  key={`over-${index}`}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  className="chart-over-line"
                />
              ))}

              <line
                x1={M.left}
                x2={M.left + plotWidth}
                y1={chart.bottom}
                y2={chart.bottom}
                className="chart-axis-line"
              />

              {hovered && (
                <g>
                  <line
                    x1={chart.x(hovered.distance_m)}
                    x2={chart.x(hovered.distance_m)}
                    y1={M.top}
                    y2={chart.bottom}
                    className="chart-cursor"
                  />
                  <circle
                    cx={chart.x(hovered.distance_m)}
                    cy={chart.y(hovered.elevation_m)}
                    r={4}
                    className={`chart-dot ${hovered.over_limit ? 'over' : ''}`}
                  />
                </g>
              )}
            </svg>

            {hovered && (
              <div
                className={`chart-tooltip ${chart.y(hovered.elevation_m) < 66 ? 'below' : ''}`}
                style={{
                  left: clamp(chart.x(hovered.distance_m), 78, width - 78),
                  top:
                    chart.y(hovered.elevation_m) < 66
                      ? chart.y(hovered.elevation_m) + 12
                      : chart.y(hovered.elevation_m) - 10,
                }}
              >
                <span className="tip-distance">{formatDistance(hovered.distance_m)}</span>
                <span className="tip-metric">{Math.round(hovered.elevation_m).toLocaleString('en-US')} m</span>
                <span className={`tip-slope ${hovered.over_limit ? 'over' : ''}`}>
                  {hovered.slope_deg === 0
                    ? '—'
                    : `${hovered.slope_deg > 0 ? '+' : ''}${hovered.slope_deg.toFixed(1)}°`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
