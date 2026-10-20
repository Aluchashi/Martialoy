"""Bilinear COG sampler tests. Skipped when rasterio/numpy are not installed."""

from __future__ import annotations

import importlib.util
import unittest

HAS_RASTERIO = importlib.util.find_spec("rasterio") is not None
HAS_NUMPY = importlib.util.find_spec("numpy") is not None

if HAS_RASTERIO and HAS_NUMPY:
    import tempfile
    from pathlib import Path

    import numpy as np
    import rasterio
    from rasterio.transform import from_origin

    from src.compute.dem import DemRaster


@unittest.skipUnless(HAS_RASTERIO and HAS_NUMPY, "rasterio/numpy are not installed")
class DemSamplerTests(unittest.TestCase):
    def _write_raster(self, path: Path, values: list[list[float]], nodata: float | None = None) -> None:
        data = np.array(values, dtype="float32")
        height, width = data.shape
        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            width=width,
            height=height,
            count=1,
            dtype="float32",
            crs="+proj=longlat +a=3389500 +b=3389500 +no_defs",
            transform=from_origin(77.5, 18.5, 0.001, 0.001),
            nodata=nodata,
        ) as dataset:
            dataset.write(data, 1)
            dataset.update_tags(latitude_type="planetocentric")

    def test_bilinear_midpoint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "plane.tif"
            self._write_raster(path, [[0.0, 10.0], [20.0, 30.0]])
            with DemRaster(path) as dem:
                # Pixel centres are (77.5005, 18.4995), (77.5015, 18.4995),
                # (77.5005, 18.4985), (77.5015, 18.4985).
                self.assertAlmostEqual(dem.sample(77.5005, 18.4995) or 0.0, 0.0, places=3)
                self.assertAlmostEqual(dem.sample(77.5015, 18.4995) or 0.0, 10.0, places=3)
                self.assertAlmostEqual(dem.sample(77.5010, 18.4995) or 0.0, 5.0, places=3)
                self.assertAlmostEqual(dem.sample(77.5010, 18.4990) or 0.0, 15.0, places=3)

    def test_nodata_returns_none(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "gap.tif"
            self._write_raster(path, [[0.0, -32768.0], [20.0, 30.0]], nodata=-32768.0)
            with DemRaster(path) as dem:
                self.assertIsNone(dem.sample(77.5010, 18.4995))
                self.assertAlmostEqual(dem.sample(77.5005, 18.4985) or 0.0, 20.0, places=3)


if __name__ == "__main__":
    unittest.main()
