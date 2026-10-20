"""Synthetic-ramp tests for the route engine.

These tests do not need rasterio, FastAPI, or the Mars cache. They exercise the
same sampler and energy code used for a real COG route.
"""

from __future__ import annotations

import math
import unittest

from src.compute.geo import MARS_RADIUS_M, haversine_m
from src.compute.profiles import load_profile
from src.compute.route import RouteError, build_route_result


def ramp_route(angle_deg: float, total_m: float = 3570.0):
    """Build a due-east route on a plane of known gradient."""

    lat = 18.44
    start_lon = 77.58
    dlon = math.degrees(total_m / (MARS_RADIUS_M * math.cos(math.radians(lat))))
    end_lon = start_lon + dlon
    start = (start_lon, lat)
    end = (end_lon, lat)

    def elevation(lon: float, _lat: float) -> float:
        x = (lon - start_lon) * math.radians(1) * MARS_RADIUS_M * math.cos(math.radians(lat))
        return x * math.tan(math.radians(angle_deg))

    return [start, end], elevation, total_m


class RampTests(unittest.TestCase):
    def test_ten_degree_ramp(self) -> None:
        coordinates, elevation, total = ramp_route(10.0)
        result = build_route_result(
            coordinates=coordinates,
            profile_id="rover",
            elevation=elevation,
            spacing_m=30.0,
        )

        self.assertEqual(result["sample_count"], 120)
        self.assertAlmostEqual(result["distance_m"], total, delta=1.0)
        self.assertAlmostEqual(result["climb_m"], total * math.tan(math.radians(10.0)), delta=0.6)
        self.assertAlmostEqual(result["max_slope_deg"], 10.0, delta=0.01)
        # The slope check must pass. Overall pass/fail also depends on energy and
        # duration, which are deliberately checked separately.
        self.assertTrue(result["checks"][0]["pass"])
        self.assertFalse(any(sample["over_limit"] for sample in result["samples"]))
        self.assertEqual(result["segments"], [])

    def test_twenty_five_degree_ramp_flips_slope_check(self) -> None:
        coordinates, elevation, total = ramp_route(25.0)
        result = build_route_result(
            coordinates=coordinates,
            profile_id="rover",
            elevation=elevation,
            spacing_m=30.0,
        )

        self.assertAlmostEqual(result["max_slope_deg"], 25.0, delta=0.01)
        self.assertGreater(len(result["segments"]), 0)
        self.assertEqual(result["segments"][0]["index"], 1)
        self.assertAlmostEqual(result["segments"][0]["over_by_deg"], 5.0, delta=0.02)
        self.assertFalse(result["checks"][0]["pass"])
        self.assertTrue(result["contingency"]["available"])
        self.assertAlmostEqual(result["distance_m"], total, delta=1.0)

    def test_nodata_does_not_create_a_fake_slope(self) -> None:
        coordinates, _, total = ramp_route(10.0)
        lat = coordinates[0][1]
        start_lon = coordinates[0][0]
        dlon = total / (MARS_RADIUS_M * math.cos(math.radians(lat))) * 180.0 / math.pi

        def elevation(lon: float, _lat: float) -> float | None:
            x = (lon - start_lon) / dlon * total
            if 1200.0 <= x <= 1290.0:
                return None
            return x * math.tan(math.radians(10.0))

        result = build_route_result(
            coordinates=coordinates,
            profile_id="rover",
            elevation=elevation,
            spacing_m=30.0,
        )

        self.assertTrue(any(sample.get("gap") for sample in result["samples"]))
        self.assertTrue(any("nodata" in warning for warning in result["warnings"]))
        # The samples that straddle the gap must not report a fabricated slope.
        gap_indices = [i for i, sample in enumerate(result["samples"]) if sample.get("gap")]
        for index in gap_indices:
            self.assertEqual(result["samples"][index]["slope_deg"], 0.0)

    def test_single_point_rejected(self) -> None:
        with self.assertRaises(RouteError):
            build_route_result(
                coordinates=[(77.58, 18.44)],
                profile_id="rover",
                elevation=lambda _lon, _lat: 0.0,
            )

    def test_assumptions_include_shared_rows(self) -> None:
        profile = load_profile("rover")
        keys = {row["key"] for row in profile["assumptions"]}
        self.assertIn("mass", keys)
        self.assertIn("gravity", keys)
        self.assertIn("spacing", keys)

    def test_human_has_secondary_ledger(self) -> None:
        coordinates, elevation, _ = ramp_route(5.0, total_m=500.0)
        result = build_route_result(
            coordinates=coordinates,
            profile_id="human",
            elevation=elevation,
            spacing_m=25.0,
        )
        self.assertIsNotNone(result["energy_secondary"])
        self.assertEqual(result["energy_secondary"]["label"], "Metabolic")
        self.assertGreater(result["energy_secondary"]["value_kcal"], 0.0)


if __name__ == "__main__":
    unittest.main()
