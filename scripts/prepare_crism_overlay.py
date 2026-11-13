#!/usr/bin/env python
"""Render a transparent OLINDEX3 overlay from a local CRISM MTRDR cube."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CUBE = ROOT / "cache" / "mars" / "crism" / "hrl000040ff_07_sr183j_mtr3.img"
DEFAULT_OUTPUT = ROOT / "cache" / "mars" / "crism" / "olindex3.png"
SAMPLES, LINES, BANDS = 455, 751, 60
OLINDEX3_BAND = 14  # 1-based band number from the PDS label / ENVI header
NODATA = 65535.0
PALETTE = np.array(
    [[54, 33, 95], [39, 106, 140], [76, 180, 119], [245, 212, 93]], dtype=np.float32
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cube", type=Path, default=DEFAULT_CUBE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    expected_bytes = SAMPLES * LINES * BANDS * 4
    if args.cube.stat().st_size != expected_bytes:
        raise SystemExit(f"Expected {expected_bytes} bytes for the labeled CRISM cube")
    cube = np.memmap(args.cube, dtype="<f4", mode="r", shape=(BANDS, LINES, SAMPLES))
    index = np.asarray(cube[OLINDEX3_BAND - 1], dtype=np.float32)
    valid = np.isfinite(index) & (index != NODATA)
    if not valid.any():
        raise SystemExit("OLINDEX3 band contains no valid pixels")

    low, high = np.quantile(index[valid], [0.02, 0.98])
    scaled = np.zeros_like(index)
    scaled[valid] = np.clip((index[valid] - low) / (high - low), 0, 1)
    position = scaled * (len(PALETTE) - 1)
    left = np.floor(position).astype(np.intp)
    right = np.minimum(left + 1, len(PALETTE) - 1)
    fraction = (position - left)[..., None]
    rgb = (PALETTE[left] * (1 - fraction) + PALETTE[right] * fraction).astype(np.uint8)
    alpha = np.zeros(index.shape, dtype=np.uint8)
    alpha[valid] = 150 + (scaled[valid] * 70).astype(np.uint8)
    rgba = np.dstack((rgb, alpha))
    rgba[~valid] = 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(args.output, optimize=True)
    print(
        f"Wrote {args.output} from OLINDEX3 band {OLINDEX3_BAND}; "
        f"valid={valid.sum()}/{valid.size}, 2–98% range={low:.5f}–{high:.5f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
