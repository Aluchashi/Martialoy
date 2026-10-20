export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(2)} km`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const totalMinutes = Math.round(seconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m.toString().padStart(2, '0')} m`
}

export function formatEnergy(wh: number): string {
  if (!Number.isFinite(wh)) return '—'
  if (wh >= 1000) return `${(wh / 1000).toFixed(2)} kWh`
  return `${Math.round(wh)} Wh`
}

export function formatDegrees(deg: number, dp = 1): string {
  if (!Number.isFinite(deg)) return '—'
  return `${deg.toFixed(dp)}°`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}
