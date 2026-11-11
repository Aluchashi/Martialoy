import type { RegionSpec } from '../types'

/** One region for the MVP. Bbox matches cache/mars/manifest.json basemap bounds so
 *  the map does not show empty space east of the cached PMTiles footprint. */
export const REGION: RegionSpec = {
  id: 'jezero',
  label: 'Jezero Crater',
  center: [77.58, 18.44],
  bbox: [77.1604655, 18.2110274, 77.6991776, 18.7211945],
}
