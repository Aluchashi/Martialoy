#!/usr/bin/env python
"""Mosaic OLINDEX3 from the local eight-scene CRISM MTRDR set."""
from __future__ import annotations
import argparse
import math
import re
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CRISM_DIR = ROOT / "cache" / "mars" / "crism"
PRODUCTS = (
    "hrl000040ff_07_sr183j_mtr3",
    "frt00021da6_07_sr166j_mtr3",
    "frt0001fb74_07_sr166j_mtr3",
    "frt0001ecba_07_sr166j_mtr3",
    "frt000066a4_07_sr166j_mtr3",
    "frt000047a3_07_sr166j_mtr3",
    "frt00005850_07_sr167j_mtr3",
    "frt00005c5e_07_sr166j_mtr3",
)
OUTPUT_RESOLUTION_M = 18.0
NODATA = 65535.0
# Retain the established map legend's display stretch for comparability.
DISPLAY_LOW, DISPLAY_HIGH = 0.08094, 0.17168
PALETTE = np.array([[54, 33, 95], [39, 106, 140], [76, 180, 119], [245, 212, 93]], dtype=np.float32)


def field(text: str, name: str) -> str:
    match = re.search(rf"^\s*{re.escape(name)}\s*=\s*(.*)$", text, re.I | re.M)
    if not match:
        raise ValueError(f"Missing {name} in CRISM ENVI header")
    return match.group(1).strip()


def read_product(stem: str) -> dict:
    header_path = CRISM_DIR / f"{stem}.hdr"
    image_path = CRISM_DIR / f"{stem}.img"
    if not header_path.exists() or not image_path.exists():
        raise FileNotFoundError(f"Missing {header_path.name} or {image_path.name}")
    text = header_path.read_text(encoding="ascii", errors="replace")
    samples, lines, bands = (int(field(text, key)) for key in ("samples", "lines", "bands"))
    if int(field(text, "data type")) != 4 or int(field(text, "byte order")) != 0:
        raise ValueError(f"{stem} must be little-endian float32 ENVI data")
    expected = samples * lines * bands * 4
    if image_path.stat().st_size != expected:
        raise ValueError(f"{stem}.img is {image_path.stat().st_size} bytes; expected {expected}")
    band_block = re.search(r"band names\s*=\s*\{([^}]*)\}", text, re.I | re.S)
    if not band_block:
        raise ValueError(f"Missing band names in {header_path.name}")
    band_names = [item.strip().strip('"') for item in band_block.group(1).replace("\n", " ").split(",")]
    try:
        band = next(i for i, name in enumerate(band_names) if name.upper() == "OLINDEX3")
    except StopIteration as exc:
        raise ValueError(f"OLINDEX3 band not found in {header_path.name}") from exc
    map_block = re.search(r"map info\s*=\s*\{([^}]*)\}", text, re.I)
    projection_block = re.search(r"projection info\s*=\s*\{([^}]*)\}", text, re.I)
    if not map_block or not projection_block:
        raise ValueError(f"Missing map projection in {header_path.name}")
    map_values = [part.strip() for part in map_block.group(1).split(",")]
    proj_values = [part.strip() for part in projection_block.group(1).split(",")]
    x0, y0 = float(map_values[3]), float(map_values[4])
    dx, dy = abs(float(map_values[5])), abs(float(map_values[6]))
    radius, standard_lat, central_lon = float(proj_values[1]), float(proj_values[2]), float(proj_values[3])
    return {
        "stem": stem, "samples": samples, "lines": lines, "bands": bands, "band": band,
        "x0": x0, "y0": y0, "dx": dx, "dy": dy,
        "radius": radius, "standard_lat": standard_lat, "central_lon": central_lon,
        "image_path": image_path,
    }


def rgba_from_index(index: np.ndarray, valid: np.ndarray) -> np.ndarray:
    scaled = np.zeros(index.shape, dtype=np.float32)
    scaled[valid] = np.clip((index[valid] - DISPLAY_LOW) / (DISPLAY_HIGH - DISPLAY_LOW), 0, 1)
    position = scaled * (len(PALETTE) - 1)
    left = np.floor(position).astype(np.intp)
    right = np.minimum(left + 1, len(PALETTE) - 1)
    fraction = (position - left)[..., None]
    rgb = (PALETTE[left] * (1 - fraction) + PALETTE[right] * fraction).astype(np.uint8)
    alpha = np.zeros(index.shape, dtype=np.uint8)
    alpha[valid] = 35 + (scaled[valid] * 165).astype(np.uint8)
    rgba = np.dstack((rgb, alpha))
    rgba[~valid] = 0
    return rgba


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=CRISM_DIR / "olindex3.png")
    args = parser.parse_args()
    products = [read_product(stem) for stem in PRODUCTS]
    first = products[0]
    for product in products[1:]:
        for key in ("radius", "standard_lat", "central_lon"):
            if not math.isclose(product[key], first[key], rel_tol=0, abs_tol=1e-5):
                raise ValueError(f"Projection mismatch in {product['stem']}: {key}")

    res = OUTPUT_RESOLUTION_M
    min_x = min(p["x0"] - p["dx"] / 2 for p in products)
    max_x = max(p["x0"] + (p["samples"] - 0.5) * p["dx"] for p in products)
    max_y = max(p["y0"] + p["dy"] / 2 for p in products)
    min_y = min(p["y0"] - (p["lines"] - 0.5) * p["dy"] for p in products)
    left = math.floor(min_x / res) * res
    right = math.ceil(max_x / res) * res
    top = math.ceil(max_y / res) * res
    bottom = math.floor(min_y / res) * res
    width, height = int(round((right - left) / res)), int(round((top - bottom) / res))
    x_centers = left + (np.arange(width, dtype=np.float64) + 0.5) * res
    y_centers = top - (np.arange(height, dtype=np.float64) + 0.5) * res
    sums = np.zeros((height, width), dtype=np.float32)
    counts = np.zeros((height, width), dtype=np.uint8)
    total_valid = 0

    for p in products:
        col_start = max(0, int(math.floor((p["x0"] - p["dx"] / 2 - left) / res)))
        col_stop = min(width, int(math.ceil((p["x0"] + (p["samples"] - 0.5) * p["dx"] - left) / res)))
        row_start = max(0, int(math.floor((top - (p["y0"] + p["dy"] / 2)) / res)))
        row_stop = min(height, int(math.ceil((top - (p["y0"] - (p["lines"] - 0.5) * p["dy"])) / res)))
        cols = np.rint((x_centers[col_start:col_stop] - p["x0"]) / p["dx"]).astype(np.intp)
        rows = np.rint((p["y0"] - y_centers[row_start:row_stop]) / p["dy"]).astype(np.intp)
        within = (cols >= 0) & (cols < p["samples"])
        rows_ok = (rows >= 0) & (rows < p["lines"])
        if not within.any() or not rows_ok.any():
            continue
        plane = np.memmap(p["image_path"], dtype="<f4", mode="r", shape=(p["bands"], p["lines"], p["samples"]))[p["band"]]
        patch = np.asarray(plane[np.ix_(rows[rows_ok], cols[within])], dtype=np.float32)
        valid = np.isfinite(patch) & (patch != NODATA)
        r0, c0 = row_start + int(np.flatnonzero(rows_ok)[0]), col_start + int(np.flatnonzero(within)[0])
        r1, c1 = r0 + patch.shape[0], c0 + patch.shape[1]
        sums[r0:r1, c0:c1] += np.where(valid, patch, 0)
        counts[r0:r1, c0:c1] += valid.astype(np.uint8)
        total_valid += int(valid.sum())
        del plane
        print(f"Included {p['stem']}: {int(valid.sum()):,} valid OLINDEX3 pixels")

    valid = counts > 0
    mosaic = np.zeros((height, width), dtype=np.float32)
    mosaic[valid] = sums[valid] / counts[valid]
    rgba = rgba_from_index(mosaic, valid)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(args.output, optimize=True)

    deg = 180 / math.pi
    lon_scale = first["radius"] * math.cos(math.radians(first["standard_lat"]))
    west = left / lon_scale * deg + first["central_lon"]
    east = right / lon_scale * deg + first["central_lon"]
    north = top / first["radius"] * deg
    south = bottom / first["radius"] * deg
    print(f"Wrote {args.output}: {width}x{height} px, {valid.sum():,} covered cells, {total_valid:,} source pixels")
    print(f"Bounds: west={west:.9f}, south={south:.9f}, east={east:.9f}, north={north:.9f}")
    print(f"Display stretch preserved: {DISPLAY_LOW:.5f}–{DISPLAY_HIGH:.5f}; overlap pixels are averaged.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
