#!/usr/bin/env python
"""Validate cache/mars/manifest.json and the cached Mars payloads.

Usage:
    python scripts/check_data.py
    python scripts/check_data.py --cache cache/mars

The raster checks are skipped with a warning when rasterio is not installed.
Exit code is non-zero if a required file, bbox, or safety-critical metadata check
fails.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE = ROOT / "cache" / "mars"


def fail(message: str) -> None:
    print(f"FAIL  {message}")


def warn(message: str) -> None:
    print(f"WARN  {message}")


def ok(message: str) -> None:
    print(f"OK    {message}")


def check_bbox(data: dict[str, Any], errors: list[str]) -> None:
    try:
        west, south, east, north = [float(v) for v in data["bbox"]]
        center_lon, center_lat = [float(v) for v in data["center"]]
    except (KeyError, TypeError, ValueError) as exc:
        errors.append(f"bbox/center malformed: {exc}")
        return
    if not (west < east and south < north):
        errors.append("bbox must be [west, south, east, north] with west < east and south < north")
    if not (west <= center_lon <= east and south <= center_lat <= north):
        errors.append("center must lie inside bbox")
    if not (-180 <= west <= 180 and -180 <= east <= 180):
        errors.append("bbox longitudes must be in [-180, 180]")
    if not (-90 <= south <= 90 and -90 <= north <= 90):
        errors.append("bbox latitudes must be in [-90, 90]")
    if not errors:
        ok(f"bbox {west}..{east} E, {south}..{north} N; center inside")


def check_pmtiles(path: Path, errors: list[str]) -> None:
    if not path.exists():
        errors.append(f"basemap missing: {path}")
        return
    with path.open("rb") as handle:
        magic = handle.read(7)
    if magic != b"PMTiles":
        errors.append(f"basemap does not start with the PMTiles magic bytes: {path}")
        return
    size_mb = path.stat().st_size / (1024 * 1024)
    ok(f"PMTiles magic valid ({size_mb:.1f} MB)")
    if size_mb > 250:
        warn("PMTiles is larger than 250 MB; the browser may feel slow on a laptop")


def check_dem(path: Path, manifest: dict[str, Any], errors: list[str]) -> None:
    if not path.exists():
        errors.append(f"DEM missing: {path}")
        return
    try:
        import rasterio
    except ImportError:
        warn("rasterio not installed; skipped CRS/nodata checks (pip install -r requirements.txt)")
        return

    try:
        with rasterio.open(path) as dataset:
            ok(f"DEM opens: {dataset.width} x {dataset.height} px, {dataset.count} band(s)")
            if dataset.crs is None:
                errors.append("DEM has no CRS")
            elif not dataset.crs.is_geographic:
                errors.append(f"DEM CRS must be geographic for this MVP: {dataset.crs}")
            else:
                ok(f"DEM CRS is geographic: {dataset.crs.to_string()}")

            tags = {key.lower(): value for key, value in dataset.tags().items()}
            latitude_type = str(tags.get("latitude_type", "")).lower()
            if latitude_type == "planetographic":
                errors.append("DEM is planetographic; convert to planetocentric before sampling")
            elif latitude_type:
                ok(f"latitude_type: {latitude_type}")
            else:
                warn("DEM has no latitude_type tag; confirm planetocentric before trusting slopes")

            dem_meta = manifest.get("dem", {})
            expected_nodata = dem_meta.get("nodata")
            if expected_nodata is not None and dataset.nodata is not None:
                if abs(float(dataset.nodata) - float(expected_nodata)) > 1e-6:
                    errors.append(
                        f"manifest nodata {expected_nodata} != raster nodata {dataset.nodata}"
                    )
                else:
                    ok(f"nodata matches manifest: {dataset.nodata}")

            resolution = abs(dataset.transform.a)
            expected_res = dem_meta.get("resolution_m")
            if expected_res is not None and resolution > 0:
                # If the CRS is degrees, transform.a is degrees/pixel, not metres.
                if dataset.crs and dataset.crs.is_geographic:
                    resolution_m = resolution * (3_389_500 * 3.141592653589793 / 180)
                else:
                    resolution_m = resolution
                if abs(resolution_m - float(expected_res)) / float(expected_res) > 0.5:
                    warn(
                        f"manifest resolution_m={expected_res}, raster approx {resolution_m:.1f} m/px"
                    )
                else:
                    ok(f"resolution approximately {resolution_m:.1f} m/px")
    except Exception as exc:
        errors.append(f"rasterio could not validate DEM: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cache",
        type=Path,
        default=DEFAULT_CACHE,
        help="cache/mars directory (default: %(default)s)",
    )
    args = parser.parse_args()
    cache: Path = args.cache
    manifest_path = cache / "manifest.json"
    errors: list[str] = []

    if not manifest_path.exists():
        fail(f"manifest missing: {manifest_path}")
        print("Copy cache/mars/manifest.example.json to cache/mars/manifest.json first.")
        return 1

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"manifest is not valid JSON: {exc}")
        return 1

    ok(f"manifest parsed: {manifest_path}")
    check_bbox(manifest, errors)

    basemap = manifest.get("basemap") or {}
    dem = manifest.get("dem") or {}
    if not basemap.get("file"):
        errors.append("manifest has no basemap.file")
    else:
        check_pmtiles(cache / str(basemap["file"]), errors)

    if not dem.get("file"):
        errors.append("manifest has no dem.file")
    else:
        check_dem(cache / str(dem["file"]), manifest, errors)

    if dem.get("vertical_datum") != "Mars areoid":
        warn("vertical_datum is not 'Mars areoid'; document the datum and do not mix heights")
    if not manifest.get("sources"):
        warn("manifest has no sources[]; add NASA Mars Trek and PDS citations")

    if errors:
        print(f"\n{len(errors)} error(s):")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("\nCache is ready for the local route engine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
