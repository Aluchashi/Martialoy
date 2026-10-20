# Mars data cache

This directory is where the local, offline Mars datasets live. Nothing here is
downloaded at runtime: MapLibre reads the PMTiles basemap and the Python engine
reads the COG DEM from this folder.

Payload files are **not committed** (see `.gitignore`). Commit only this README
and `manifest.example.json`.

## Required files

| File | Format | Used by | Notes |
|---|---|---|---|
| `basemap.pmtiles` | Raster or vector PMTiles | MapLibre | Export the NASA Mars Trek regional mosaic for Jezero |
| `jezero_dem.tif` | Cloud-optimised GeoTIFF (COG) | `src/compute/dem.py` | 20–50 m/px regional DEM, Mars areoid heights |
| `manifest.json` | JSON | web + API | Copy `manifest.example.json` and edit paths/metadata |

`manifest.json` is the only filename the app knows. Keep the payload names
stable so a fresh clone behaves the same way once the files are dropped in.

## Manifest

```powershell
Copy-Item cache/mars/manifest.example.json cache/mars/manifest.json
```

Then edit:

- `bbox` and `center` to the actual regional crop (lon, lat order).
- `basemap.file` / `dem.file` to the filenames above.
- `dem.crs`, `dem.vertical_datum`, `dem.resolution_m`, `dem.nodata`.
- `sources[]` with the exact Mars Trek / PDS product pages used.

The frontend probes `/mars/manifest.json`; when it is absent or the basemap is
missing it shows **No cached basemap — drawing still works** and keeps the demo
engine available. The API returns a clear `503` when the DEM is missing.

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
