# Data pipeline and audit trail

Status: **Jezero DEM prepared locally; basemap still missing**. The app can use
the local DEM for route calculations, while map tiles still need to be added to
`cache/mars/`.

## 0. Prepared DEM in this checkout

Source file: `Data/M20_JezeroCrater_CTXDEM_20m.tif`, the USGS Astrogeology
Mars 2020 Science Investigation CTX DEM Mosaic. USGS metadata identifies it as
a 20 m/pixel, planetocentric Jezero crater mosaic, controlled to the MOLA
control net; added stereo DEMs were vertically localized to MOLA. See the
[USGS product record](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic)
for product details and the source file URL.

Run `python scripts/prepare_dem.py "../Data/M20_JezeroCrater_CTXDEM_20m.tif"`
from the `Martialoy` directory to create `cache/mars/jezero_dem.tif`. The
script reprojects from the source Mars equirectangular CRS to its Mars
geographic base CRS using bilinear interpolation, preserves elevation values,
sets nodata to -32768, and tags the planetocentric latitude convention. It does
not transform to Earth EPSG:4326. The prepared file covers approximately
76.9974–78.5829°E, 17.5805–19.2902°N at about 20 m/pixel.

## 1. Choose the region

MVP region: **Jezero Crater**, bounded by the manifest bbox
`[77.38, 18.34, 77.72, 18.58]` (lon/lat, planetocentric).

Keep the basemap and DEM crops identical. A mismatch is visible on screen: the
drawn route no longer follows the imagery, and slope verdicts are wrong.

## 2. Acquire the DEM

Preferred sources:

- HiRISE/CTX stereo DTM covering Jezero, distributed through PDS.
- NASA Mars Trek blended DEM export for the same bbox.
- A published Jezero DEM product with a clear product ID and citation.

Record before conversion:

- product title and product ID;
- instrument/team;
- download date and URL;
- original CRS, latitude convention (planetocentric vs planetographic);
- vertical datum (Mars areoid vs ellipsoid);
- pixel spacing and nodata value;
- licence/usage terms.

Inspect the GeoTIFF:

```bash
gdalinfo jezero_dem_source.tif
```

Look for `AREA_OR_POINT`, `latitude_type`, the CRS authority, and `NoData Value`.
If the source is planetographic, convert latitudes to planetocentric before
sampling. Do not silently mix conventions.

## 3. Build the COG

The engine expects a cloud-optimised GeoTIFF with areoid heights. Example
(command shown for documentation; adjust paths and compression for the actual
product):

```bash
gdal_translate jezero_dem_source.tif jezero_dem.tif \
  -of COG \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=2 \
  -co BLOCKSIZE=512 \
  -co OVERVIEWS=IGNORE_EXISTING \
  -a_nodata -32768
```

If reprojection is required, do it explicitly and record the target CRS. A
planetocentric geographic CRS is the simplest target for this MVP.

Add overviews if the source has none:

```bash
gdaladdo -r average jezero_dem.tif 2 4 8 16
```

Verify the result:

```bash
rio info jezero_dem.tif
python scripts/check_data.py
```

The checker reads `cache/mars/manifest.json`, checks the bbox, CRS metadata,
nodata, and that both payload files exist. It is deliberately strict about the
latitude convention because that is the failure mode most likely to produce
plausible-but-wrong slopes.

## 4. Build the PMTiles basemap

Export the Mars Trek mosaic for the same bbox. The exact export mechanism
depends on the Mars Trek product (GeoTIFF, WMS, or an existing tile package).
Keep the intermediate MBTiles/GeoTIFF out of git.

Typical conversion from MBTiles:

```bash
pmtiles convert jezero_basemap.mbtiles basemap.pmtiles
```

Or from a georeferenced image, build a tile pyramid first (GDAL/QGIS/tippecanoe
depending on format), then convert. Target z8–z13 for a regional view and keep
the file under roughly 150 MB for a smooth demo.

Record:

- export date;
- source layer/product;
- zoom range;
- attribution string;
- whether the export is a raster or vector tileset.

The web client treats the basemap as a raster source by default. If you export
vector tiles, update `MapView.tsx` and the manifest `type` together.

## 5. Create the manifest

```powershell
Copy-Item cache/mars/manifest.example.json cache/mars/manifest.json
notepad cache/mars/manifest.json
```

Set the real filenames and metadata. The frontend reads this file at
`/mars/manifest.json`; the API reads the same file from disk. Keep the two paths
in sync.

## 6. Offline verification

1. Start the API and the built web client.
2. Disable the network adapter (or block all non-loopback traffic).
3. Reload the app.
4. Confirm the basemap renders and a drawn route produces a profile.
5. Confirm the header badge says **Local DEM**, not **Demo terrain**.

If the badge says **No cached basemap**, the manifest or PMTiles probe failed.
If the API returns `503`, the DEM is missing or unreadable.

## 7. Attribution

The footer and manifest must credit NASA Mars Trek and PDS. If a specific
instrument team or product requires a citation, add it to the manifest sources
and to `docs/references.md`. NASA data are generally public domain, but always
check the product's own terms before redistributing a derived export.


## CRISM OLINDEX3 context layer

The local map uses CRISM MTRDR product `HRL000040FF_07_SR183J_MTR3`. The PDS
cube and label files are kept under `cache/mars/crism/`; the reproducible
converter is `scripts/prepare_crism_overlay.py`. It extracts band 14
(`OLINDEX3`) from the 60-band float32 BSQ cube to a transparent PNG. The display
stretch uses the valid-pixel 2nd–98th percentiles (0.08094–0.17168). The
manifest footprint shows partial coverage near Jezero. OLINDEX3 is an
olivine-like spectral parameter, not a definitive mineral identification.
The generated asset is copied to `src/web/public/mars/crism/` for a static build.
