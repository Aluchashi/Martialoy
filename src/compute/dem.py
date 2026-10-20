"""COG adapter and manifest loader.

rasterio is imported lazily so the pure route/graph tests do not need GDAL. The
runtime path is:

    cache/mars/manifest.json -> dem.file -> rasterio.open -> bilinear sample

Only geographic (lon/lat) DEMs are accepted here. The data checker validates the
planetocentric latitude convention and the Mars-areoid vertical datum; a DEM
tagged planetographic is rejected at open time because it would shift routes and
corrupt slope verdicts.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CACHE_DIR = ROOT / "cache" / "mars"


class DemUnavailable(RuntimeError):
    """Raised when the regional DEM cannot be opened or sampled."""


@dataclass(frozen=True)
class Manifest:
    path: Path
    data: dict[str, Any]

    @property
    def region(self) -> str:
        return str(self.data.get("region", "jezero"))

    @property
    def label(self) -> str:
        return str(self.data.get("label", self.region))

    @property
    def dem_file(self) -> Path:
        dem = self.data.get("dem") or {}
        name = dem.get("file")
        if not name:
            raise DemUnavailable("manifest.json has no dem.file")
        return self.path.parent / str(name)


def read_manifest(cache_dir: Path | str = DEFAULT_CACHE_DIR) -> Manifest:
    path = Path(cache_dir) / "manifest.json"
    if not path.exists():
        raise DemUnavailable(
            f"{path} is missing. Copy cache/mars/manifest.example.json and cache the DEM."
        )
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DemUnavailable(f"Could not read {path}: {exc}") from exc
    return Manifest(path=path, data=data)


class DemRaster:
    """Bilinear sampler over a cloud-optimised GeoTIFF."""

    def __init__(self, path: Path | str) -> None:
        try:
            import rasterio
        except ImportError as exc:  # pragma: no cover - depends on local install
            raise DemUnavailable(
                "rasterio is not installed. Run: pip install -r requirements.txt"
            ) from exc

        self.path = Path(path)
        try:
            self._ds = rasterio.open(self.path)
        except Exception as exc:  # rasterio raises several exception types
            raise DemUnavailable(f"Could not open DEM {self.path}: {exc}") from exc

        self.crs = self._ds.crs
        self.nodata = self._ds.nodata
        self.width = self._ds.width
        self.height = self._ds.height
        self.transform = self._ds.transform
        self.latitude_type = (self._ds.tags().get("latitude_type") or "").lower()

        if self.crs is not None and not self.crs.is_geographic:
            self.close()
            raise DemUnavailable(
                "DEM must be in a geographic (lon/lat) CRS for this MVP; "
                f"got {self.crs.to_string()}"
            )
        if self.latitude_type == "planetographic":
            self.close()
            raise DemUnavailable(
                "DEM is tagged planetographic. Convert it to planetocentric before sampling; "
                "see docs/data.md."
            )

    def close(self) -> None:
        dataset = getattr(self, "_ds", None)
        if dataset is not None:
            dataset.close()
            self._ds = None  # type: ignore[assignment]

    def __enter__(self) -> "DemRaster":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def sample(self, lon: float, lat: float) -> float | None:
        """Bilinear elevation in metres, or ``None`` outside the raster/nodata."""

        dataset = self._ds
        if dataset is None:
            raise DemUnavailable("DEM is closed")

        col_corner, row_corner = (~self.transform) @ (lon, lat)
        # Rasterio's inverse transform is in corner coordinates; pixel centres
        # are half a pixel in from the corner.
        x = col_corner - 0.5
        y = row_corner - 0.5
        if x < -0.5 or x > self.width - 0.5 or y < -0.5 or y > self.height - 0.5:
            return None
        if self.width < 2 or self.height < 2:
            return self._sample_single_pixel(dataset, x, y)

        # Clamp the 2x2 window so sampling at the last row/column centre still
        # uses the edge pixel instead of requiring a neighbour outside the COG.
        c0 = min(max(int(x // 1), 0), self.width - 2)
        r0 = min(max(int(y // 1), 0), self.height - 2)
        tx = min(1.0, max(0.0, x - c0))
        ty = min(1.0, max(0.0, y - r0))
        try:
            from rasterio.windows import Window

            window = Window(c0, r0, 2, 2)
            values = dataset.read(1, window=window, masked=True)
        except Exception as exc:
            raise DemUnavailable(f"DEM read failed at {lon:.5f},{lat:.5f}: {exc}") from exc

        if values.shape != (2, 2):
            return None

        weights = (
            ((0, 0), (1 - tx) * (1 - ty)),
            ((0, 1), tx * (1 - ty)),
            ((1, 0), (1 - tx) * ty),
            ((1, 1), tx * ty),
        )
        mask = values.mask
        if mask is True:
            return None
        mask_array = mask if getattr(mask, "ndim", 0) == 2 else None
        for (row, col), weight in weights:
            if weight <= 1e-12:
                continue
            if mask_array is not None and bool(mask_array[row, col]):
                return None

        data = values.filled(self.nodata if self.nodata is not None else float("nan"))
        top = float(data[0, 0]) * (1 - tx) + float(data[0, 1]) * tx
        bottom = float(data[1, 0]) * (1 - tx) + float(data[1, 1]) * tx
        result = top * (1 - ty) + bottom * ty
        if self.nodata is not None and abs(result - float(self.nodata)) < 1e-6:
            return None
        return result

    def _sample_single_pixel(self, dataset, x: float, y: float) -> float | None:
        """Degenerate case for a 1-row or 1-column COG."""

        col = min(max(int(round(x)), 0), self.width - 1)
        row = min(max(int(round(y)), 0), self.height - 1)
        try:
            from rasterio.windows import Window

            values = dataset.read(1, window=Window(col, row, 1, 1), masked=True)
        except Exception as exc:
            raise DemUnavailable(f"DEM read failed at {x:.5f},{y:.5f}: {exc}") from exc
        if values.size == 0 or bool(values.mask.any()):
            return None
        return float(values[0, 0])

    def __call__(self, lon: float, lat: float) -> float | None:
        return self.sample(lon, lat)


def find_region_manifest(
    region: str = "jezero", cache_dir: Path | str = DEFAULT_CACHE_DIR
) -> Manifest:
    """Return the manifest, checking that it describes the requested region."""

    manifest = read_manifest(cache_dir)
    if manifest.region.lower() != region.lower():
        raise DemUnavailable(
            f"Manifest region is {manifest.region!r}, not {region!r}. "
            "One cache directory holds one region in this MVP."
        )
    return manifest


def load_region_dem(
    region: str = "jezero", cache_dir: Path | str = DEFAULT_CACHE_DIR
) -> DemRaster:
    manifest = find_region_manifest(region, cache_dir)
    path = manifest.dem_file
    if not path.exists():
        raise DemUnavailable(
            f"DEM payload is missing: {path}. See cache/mars/README.md and docs/data.md."
        )
    return DemRaster(path)


__all__ = [
    "DEFAULT_CACHE_DIR",
    "DemRaster",
    "DemUnavailable",
    "Manifest",
    "find_region_manifest",
    "load_region_dem",
    "read_manifest",
]
