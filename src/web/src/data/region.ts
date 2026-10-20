import type { RegionSpec } from '../types'

/** One region for the MVP. The real bbox will come from cache/mars/manifest.json. */
export const REGION: RegionSpec = {
  id: 'jezero',
  label: 'Jezero Crater',
  center: [77.58, 18.44],
  bbox: [77.35, 18.3, 77.85, 18.6],
}
