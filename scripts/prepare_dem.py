"""Reproject the USGS Jezero CTX DEM into the route engine's Mars lon/lat grid.

Usage from the repository root:
    python scripts/prepare_dem.py "../Data/M20_JezeroCrater_CTXDEM_20m.tif"

The output is a tiled GeoTIFF in cache/mars/jezero_dem.tif. The source uses a
Mars equirectangular CRS; the destination uses that CRS's Mars geographic base
CRS, never terrestrial EPSG:4326.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import rasterio
from rasterio.warp import Resampling, calculate_default_transform, reproject

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "cache" / "mars" / "jezero_dem.tif"
OUTPUT_NODATA = -32768.0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="USGS M20 Jezero CTX DEM GeoTIFF")
    args = parser.parse_args()
    source_path = args.source.resolve()
    if not source_path.exists():
        parser.error(f"source DEM does not exist: {source_path}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(source_path) as src:
        if src.crs is None or src.crs.is_geographic:
            raise SystemExit("Expected the source Mars equirectangular projected CRS")
        mars_geographic = src.crs.geodetic_crs
        if mars_geographic is None or "Mars" not in mars_geographic.to_wkt():
            raise SystemExit("Source CRS does not identify a Mars geographic base CRS")

        # Use ~20 m at Jezero latitude, preserving the source sampling scale.
        mars_radius_m = 3_396_160.0
        lat0 = math.radians(18.4663)
        resolution_y = 20.0 / mars_radius_m * 180.0 / math.pi
        resolution_x = resolution_y / math.cos(lat0)
        transform, width, height = calculate_default_transform(
            src.crs,
            mars_geographic,
            src.width,
            src.height,
            *src.bounds,
            resolution=(resolution_x, resolution_y),
        )
        profile = {
            "driver": "GTiff",
            "width": width,
            "height": height,
            "count": 1,
            "dtype": "float32",
            "crs": mars_geographic,
            "transform": transform,
            "nodata": OUTPUT_NODATA,
            "tiled": True,
            "blockxsize": 512,
            "blockysize": 512,
            "compress": "DEFLATE",
            "predictor": 3,
            "BIGTIFF": "IF_SAFER",
        }
        with rasterio.open(OUTPUT, "w", **profile) as dst:
            reproject(
                source=rasterio.band(src, 1),
                destination=rasterio.band(dst, 1),
                src_transform=src.transform,
                src_crs=src.crs,
                src_nodata=src.nodata,
                dst_transform=transform,
                dst_crs=mars_geographic,
                dst_nodata=OUTPUT_NODATA,
                resampling=Resampling.bilinear,
                init_dest_nodata=True,
                num_threads=2,
            )
            dst.update_tags(
                latitude_type="planetocentric",
                vertical_datum="Mars areoid (MOLA localized)",
                source="USGS Astrogeology Mars 2020 Science Investigation CTX DEM Mosaic",
                source_product="M20_JezeroCrater_CTXDEM_20m.tif",
                source_url="https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic",
                processing="Bilinear reprojection from Mars equirectangular to Mars geographic",
            )

    with rasterio.open(OUTPUT) as result:
        data = result.read(1, masked=True)
        if not result.crs.is_geographic:
            raise SystemExit("Output CRS is not geographic")
        if result.tags().get("latitude_type") != "planetocentric":
            raise SystemExit("Output latitude convention tag is missing")
        if data.count() == 0:
            raise SystemExit("Output contains no valid elevation cells")
        print(f"Output: {OUTPUT}")
        print(f"CRS: {result.crs.to_string()}")
        print(f"Dimensions: {result.width} x {result.height}")
        print(f"Bounds (lon/lat): {result.bounds}")
        print(f"Resolution (deg): {result.res}")
        print(f"Valid elevation range (m): {float(data.min()):.2f} .. {float(data.max()):.2f}")
        print(f"Valid cells: {data.count()} / {result.width * result.height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
