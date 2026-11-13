import { useEffect, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  ScaleControl,
  addProtocol,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLat,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Feature, FeatureCollection } from 'geojson'
import { REGION } from '../data/region'
import type { LonLat, RouteResult, RouteSample } from '../types'

let libReady = false
function registerMapLibre() {
  if (libReady) return
  // Vite pre-bundling breaks MapLibre's implicit worker URL, so point at the
  // worker explicitly. Works in dev and in the production build.
  setWorkerUrl(maplibreWorkerUrl)
  const protocol = new Protocol()
  addProtocol('pmtiles', protocol.tile)
  libReady = true
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

function lineFeature(coords: LonLat[]): FeatureCollection {
  if (coords.length < 2) return EMPTY
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }],
  }
}

function makeStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      graticule: { type: 'geojson', data: graticuleData() },
      'study-area': { type: 'geojson', data: studyAreaData() },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#120e0b' },
      },
      {
        id: 'graticule',
        type: 'line',
        source: 'graticule',
        paint: { 'line-color': 'rgba(233,214,196,0.07)', 'line-width': 1 },
      },
      {
        id: 'study-area',
        type: 'line',
        source: 'study-area',
        paint: {
          'line-color': 'rgba(224,101,58,0.28)',
          'line-width': 1.2,
          'line-dasharray': [3, 4],
        },
      },
    ],
  }
}

function graticuleData(): FeatureCollection {
  const [w, s, e, n] = REGION.bbox
  const features: Feature[] = []
  for (let lon = Math.ceil(w * 50) / 50; lon <= e; lon += 0.02) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[lon, s], [lon, n]] },
    })
  }
  for (let lat = Math.ceil(s * 50) / 50; lat <= n; lat += 0.02) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[w, lat], [e, lat]] },
    })
  }
  return { type: 'FeatureCollection', features }
}

/** A 2.5 km dashed ring around the study centre — an extent cue, not imagery. */
function studyAreaData(): FeatureCollection {
  const [lon0, lat0] = REGION.center
  const radiusM = 2500
  const points: LonLat[] = []
  for (let i = 0; i <= 96; i++) {
    const angle = (i / 96) * Math.PI * 2
    const dx = Math.cos(angle) * radiusM
    const dy = Math.sin(angle) * radiusM
    const lat = lat0 + (dy / 3_389_500) * (180 / Math.PI)
    const lon = lon0 + (dx / (3_389_500 * Math.cos((lat0 * Math.PI) / 180))) * (180 / Math.PI)
    points.push([lon, lat])
  }
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } },
    ],
  }
}

interface Props {
  points: LonLat[]
  result: RouteResult | null
  contingency: LonLat[] | null
  hover: RouteSample | null
  /** Increment to ask the map to frame the current route (preset / detour). */
  fitNonce: number
  onAddPoint: (point: LonLat) => void
  onUndo: () => void
  onClear: () => void
  onFinish?: () => void
}

export function MapView({
  points,
  result,
  contingency,
  hover,
  fitNonce,
  onAddPoint,
  onUndo,
  onClear,
  onFinish,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const clickTimer = useRef<number | undefined>(undefined)
  const drawingRef = useRef(false)
  const userMovedMapRef = useRef(false)
  const markersRef = useRef<Marker[]>([])
  const coordRef = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  const [crismReady, setCrismReady] = useState(false)
  const [crismVisible, setCrismVisible] = useState(false)

  const live = useRef({ points, result, contingency, hover, onAddPoint, onUndo })
  live.current = { points, result, contingency, hover, onAddPoint, onUndo }

  useEffect(() => {
    if (!containerRef.current) return
    registerMapLibre()

    const map = new MapLibreMap({
      container: containerRef.current,
      style: makeStyle(),
      center: REGION.center,
      zoom: 11.8,
      maxBounds: [
        [REGION.bbox[0] - 0.05, REGION.bbox[1] - 0.03],
        [REGION.bbox[2] + 0.05, REGION.bbox[3] + 0.03],
      ],
      attributionControl: false,
      minZoom: 9.5,
      maxZoom: 15,
      dragRotate: false,
      pitchWithRotate: false,
      doubleClickZoom: false,
      scrollZoom: false,
      cooperativeGestures: true,
    })
    mapRef.current = map
    map.on('movestart', (event) => {
      if (event.originalEvent) userMovedMapRef.current = true
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#05070f', 'line-width': 8, 'line-opacity': 0.85 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ff7a45', 'line-width': 3.5 },
      })

      map.addSource('hazards', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'hazards',
        type: 'line',
        source: 'hazards',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#ff5f4a', 'line-width': 6 },
      })

      map.addSource('contingency', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'contingency',
        type: 'line',
        source: 'contingency',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f0b35a', 'line-width': 2.5, 'line-dasharray': [2, 1.6] },
      })

      map.addSource('preview', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'preview',
        type: 'line',
        source: 'preview',
        paint: { 'line-color': 'rgba(245,236,227,0.55)', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      })

      map.addSource('vertices', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'vertices',
        type: 'circle',
        source: 'vertices',
        paint: {
          'circle-radius': ['match', ['get', 'role'], 'start', 6, 'end', 6, 4],
          'circle-color': ['match', ['get', 'role'], 'start', '#4bd6c4', 'end', '#ff7a45', '#eef2ff'],
          'circle-stroke-color': '#05070f',
          'circle-stroke-width': 2,
        },
      })

      map.addSource('hover', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'hover',
        type: 'circle',
        source: 'hover',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffd9c4',
          'circle-stroke-color': '#ff7a45',
          'circle-stroke-width': 2,
        },
      })

      setReady(true)
      void loadBasemap(map)
    })

    // Load the real cached basemap if cache/mars/manifest.json exists.
    async function loadBasemap(m: MapLibreMap) {
      try {
        const manifestResponse = await fetch('/mars/manifest.json', { cache: 'no-store' })
        if (!manifestResponse.ok) throw new Error('no manifest')
        const manifest = (await manifestResponse.json()) as {
          basemap?: {
            file?: string
            tileSize?: number
            attribution?: string
            bounds?: [number, number, number, number]
          }
          crism?: {
            file?: string
            coordinates?: [[number, number], [number, number], [number, number], [number, number]]
          }
        }
        const file = manifest.basemap?.file
        if (!file) throw new Error('no basemap file')

        const url = `${window.location.origin}/mars/${file}`
        const probe = await fetch(url, { headers: { Range: 'bytes=0-1' } })
        if (!probe.ok) throw new Error('basemap missing')

        m.addSource('basemap', {
          type: 'raster',
          url: `pmtiles://${url}`,
          tileSize: manifest.basemap?.tileSize ?? 256,
        })
        m.addLayer(
          {
            id: 'basemap',
            type: 'raster',
            source: 'basemap',
            paint: { 'raster-opacity': 0.95, 'raster-resampling': 'linear' },
          },
          'graticule',
        )
        const crism = manifest.crism
        if (crism?.file && crism.coordinates?.length === 4) {
          const crismUrl = `${window.location.origin}/mars/${crism.file}`
          const crismProbe = await fetch(crismUrl, { headers: { Range: 'bytes=0-1' } })
          if (crismProbe.ok) {
            m.addSource('crism-olivine', {
              type: 'image',
              url: crismUrl,
              coordinates: crism.coordinates,
            })
            m.addLayer(
              {
                id: 'crism-olivine',
                type: 'raster',
                source: 'crism-olivine',
                layout: { visibility: 'none' },
                paint: { 'raster-opacity': 0.78, 'raster-resampling': 'linear' },
              },
              'graticule',
            )
            setCrismReady(true)
          }
        }
        const bounds = manifest.basemap?.bounds
        if (bounds && bounds.every(Number.isFinite)) {
          // The PMTiles archive covers only part of the larger DEM planning
          // region. Frame its real footprint so the raster fills the map on
          // first load instead of leaving a large grid-only area in view.
          const [west, south, east, north] = bounds
          // Keep selection inside the overlap: the DEM is larger, but only
          // this footprint has matching orbital imagery underneath it.
          m.setMaxBounds([
            [west, south],
            [east, north],
          ])
          if (!userMovedMapRef.current) {
            const points = live.current.points
            const longitudes = [...bounds.filter((_, index) => index % 2 === 0), ...points.map(([lon]) => lon)]
            const latitudes = [...bounds.filter((_, index) => index % 2 === 1), ...points.map(([, lat]) => lat)]
            m.fitBounds(
              [
                [Math.min(...longitudes), Math.min(...latitudes)],
                [Math.max(...longitudes), Math.max(...latitudes)],
              ],
              { padding: 32, maxZoom: 12, duration: 0 },
            )
          }
        }
      } catch {
        // Keep the map interactive if no local basemap is available.
      }
    }

    const handleClick = (event: MapMouseEvent) => {
      drawingRef.current = true
      const point: LonLat = [event.lngLat.lng, event.lngLat.lat]
      window.clearTimeout(clickTimer.current)
      clickTimer.current = window.setTimeout(() => {
        live.current.onAddPoint(point)
      }, 190)
    }

    const handleDoubleClick = () => {
      window.clearTimeout(clickTimer.current)
      drawingRef.current = false
      setPreview(map, null, null)
    }

    const handleMove = (event: MapMouseEvent) => {
      if (coordRef.current) {
        coordRef.current.textContent = `${Math.abs(event.lngLat.lat).toFixed(4)}°${event.lngLat.lat >= 0 ? 'N' : 'S'}  ${Math.abs(event.lngLat.lng).toFixed(4)}°${event.lngLat.lng >= 0 ? 'E' : 'W'}`
      }
      if (!drawingRef.current) {
        setPreview(map, null, null)
        return
      }
      const current = live.current.points
      if (current.length === 0) {
        setPreview(map, null, event.lngLat)
        return
      }
      setPreview(map, current[current.length - 1], event.lngLat)
    }

    const handleLeave = () => setPreview(map, null, null)

    const handleContext = (event: MapMouseEvent) => {
      event.preventDefault()
      live.current.onUndo()
    }

    map.on('click', handleClick)
    map.on('dblclick', handleDoubleClick)
    map.on('mousemove', handleMove)
    map.on('mouseout', handleLeave)
    map.on('contextmenu', handleContext)

    return () => {
      window.clearTimeout(clickTimer.current)
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !crismReady || !map.getLayer('crism-olivine')) return
    map.setLayoutProperty('crism-olivine', 'visibility', crismVisible ? 'visible' : 'none')
  }, [crismReady, crismVisible])

  const fittedNonce = useRef(0)

  useEffect(() => {
    if (!ready || fitNonce === 0 || fitNonce === fittedNonce.current) return
    const map = mapRef.current
    if (!map || points.length < 2) return
    fittedNonce.current = fitNonce

    const framed = contingency && contingency.length > 1 ? [...points, ...contingency] : points
    const lons = framed.map((point) => point[0])
    const lats = framed.map((point) => point[1])
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      {
        padding: { top: 84, bottom: 80, left: 84, right: 84 },
        maxZoom: 13.5,
        duration: 650,
      },
    )
  }, [ready, fitNonce, points, contingency])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return

    setData(map, 'route', lineFeature(points))

    const hazardFeatures: Feature[] = []
    if (result) {
      const samples = result.samples
      for (let i = 1; i < samples.length; i++) {
        if (!samples[i].over_limit) continue
        hazardFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [samples[i - 1].lon, samples[i - 1].lat],
              [samples[i].lon, samples[i].lat],
            ],
          },
        })
      }
    }
    setData(map, 'hazards', { type: 'FeatureCollection', features: hazardFeatures })
    setData(map, 'contingency', lineFeature(contingency ?? []))

    // Long least-cost paths would turn every grid node into a dot, so only show
    // intermediate handles for hand-drawn routes.
    const handles =
      points.length <= 12
        ? points.map((point, index) => ({ point, index }))
        : [
            { point: points[0], index: 0 },
            { point: points[points.length - 1], index: points.length - 1 },
          ]
    const features: Feature[] = handles.map(({ point, index }) => ({
      type: 'Feature',
      properties: {
        index,
        role: index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'vertex',
      },
      geometry: { type: 'Point', coordinates: point },
    }))
    setData(map, 'vertices', { type: 'FeatureCollection', features })

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []
    if (points.length >= 2) {
      markersRef.current.push(
        addPin(map, points[0], 'S'),
        addPin(map, points[points.length - 1], 'E'),
      )
    }

    if (!hover) {
      setData(map, 'hover', EMPTY)
    } else {
      setData(map, 'hover', {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [hover.lon, hover.lat] },
          },
        ],
      })
    }
  }, [ready, points, result, contingency, hover])

  return (
    <div className="route-map-stack">
      <div className="map-shell">
        <div ref={containerRef} className="map-root" />

        <div className="map-readout" aria-hidden="true">
          <span ref={coordRef}>18.4400°N 77.5800°E</span>
          <span className="sep">·</span>
          <span>{REGION.label}</span>
        </div>

        {result && (
          <div className="map-legend">
            <span className="legend-swatch route" /> Traverse
            <span className="legend-swatch hazard" /> Over limit
            {contingency && (
              <>
                <span className="legend-swatch contingency" /> Contingency
              </>
            )}
          </div>
        )}
        {crismReady && crismVisible && (
          <div className="crism-legend">
            <strong>OLINDEX3 · spectral index</strong>
            <div className="crism-gradient" />
            <div className="crism-range"><span>0.081 · lower</span><span>0.172 · higher</span></div>
            <small>Olivine-like signal, not a confirmed mineral map. Partial scene coverage.</small>
          </div>
        )}
      </div>

      <div className="map-toolbar map-toolbar-below">
        <span className="eyebrow">Draw traverse</span>
        <p className="map-help">Click to add a vertex · Finish when done</p>
        <div className="map-actions">
          <button type="button" className="btn btn-ghost" onClick={onUndo} disabled={points.length === 0}>
            Undo
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              drawingRef.current = false
              onClear()
            }}
            disabled={points.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              drawingRef.current = false
              if (mapRef.current) setPreview(mapRef.current, null, null)
              onFinish?.()
            }}
            disabled={points.length < 2}
          >
            Finish route
          </button>
          <span className="vertex-count">
            {points.length} {points.length === 1 ? 'vertex' : 'vertices'}
          </span>
        </div>
        {crismReady && (
          <label className="crism-toggle">
            <input type="checkbox" checked={crismVisible} onChange={(event) => setCrismVisible(event.target.checked)} />
            <span>CRISM olivine index</span>
          </label>
        )}
      </div>
    </div>
  )
}

function addPin(map: MapLibreMap, point: LonLat, label: string): Marker {
  const element = document.createElement('div')
  element.className = 'wp-pin'
  element.textContent = label
  return new Marker({ element, offset: [0, -2] }).setLngLat(point).addTo(map)
}

function setData(map: MapLibreMap, source: string, data: FeatureCollection) {
  const src = map.getSource(source)
  if (src && 'setData' in src) {
    ;(src as GeoJSONSource).setData(data)
  }
}

function setPreview(map: MapLibreMap, from: LonLat | null, to: LngLat | null) {
  if (!from || !to) {
    setData(map, 'preview', EMPTY)
    return
  }
  setData(map, 'preview', lineFeature([from, [to.lng, to.lat]]))
}


