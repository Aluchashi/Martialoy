# Mars data cache

This directory is where the local, offline Mars datasets live. Nothing here is
downloaded at runtime: MapLibre reads the PMTiles basemap and the Python engine
reads the DEM from this folder. This checkout already contains the Jezero DEM,
the matching `basemap.pmtiles`, and a `manifest.json` that points to both.

Payload files are **not committed** (see `.gitignore`). Commit only this README
and `manifest.example.json`.

## Required files

| File | Format | Used by | Notes |
|---|---|---|---|
| `basemap.pmtiles` | Raster PMTiles | MapLibre | Jezero CTX orbital image mosaic |
| `jezero_dem.tif` | Tiled GeoTIFF | `src/compute/dem.py` | Prepared from the 20 m/pixel USGS CTX mosaic; MOLA localized |
| `manifest.json` | JSON | web + API | Copy `manifest.example.json` and edit paths/metadata |

`manifest.json` tells the app which local files to use. The frontend serves
these files at `/mars` in Vite dev/preview, and the FastAPI app serves them at
`/mars` when running the backend. Both payloads and the local manifest are
ignored by git, so prepare or copy them again when setting up a fresh clone.

## Manifest

```powershell
Copy-Item cache/mars/manifest.example.json cache/mars/manifest.json
```

Then edit:

- `bbox` and `center` to the actual regional crop (lon, lat order).
- `basemap.file` / `dem.file` to the filenames above. Set `basemap.bounds`
  to the PMTiles image footprint in lon/lat order so point selection stays
  over imagery that overlaps the DEM.
- `dem.crs`, `dem.vertical_datum`, `dem.resolution_m`, `dem.nodata`.
- `sources[]` with the exact Mars Trek / PDS product pages used.

The point selection map reads `/mars/manifest.json` and adds the local PMTiles
as a raster layer beneath the route, markers, and grid. Its selectable view is
framed to the image/DEM overlap; the DEM covers a larger Jezero area. If the manifest or
basemap cannot be served, it shows **No cached basemap — drawing still works**.
The API returns a clear `503` when the DEM is missing.

## Producing the files

See `docs/data.md` for the exact commands and the audit trail. In short:

1. Download a Jezero regional DEM (HiRISE/CTX stereo DTM or the Mars Trek
   blended DEM) from NASA/PDS. Record the product ID and download date.
2. Convert it to a COG in a **planetocentric** geographic CRS, preserving the
   Mars areoid vertical datum. Check `latitude_type` in the GeoTIFF metadata.
3. Export the matching Mars Trek basemap crop to PMTiles (`pmtiles convert`
   from an MBTiles/GeoTIFF source).
4. Put both files here, create `manifest.json`, and run:

   ```powershell
   python scripts/check_data.py
   ```

## Licensing and attribution

NASA data are generally in the public domain, but each product has its own
citation and usage terms. Credit NASA Mars Trek, the instrument team, and PDS in
the manifest and in the app footer. Do not redistribute a basemap export if its
source terms do not allow it.

## CRS reminder

Mars datasets are often stored in planetocentric coordinates. Mixing
planetocentric and planetographic latitudes shifts routes and corrupts slope
verdicts. The checker refuses to pass a DEM whose latitude convention cannot be
confirmed.
