"""Least-cost path tests on synthetic terrain.

The terrain is a north-south wall with one northern gap. A slope-limited search
must use the gap; a wall with no gap must set ``relaxed`` on the retry.
"""

from __future__ import annotations

import unittest

from src.compute.geo import haversine_m, to_local_meters
from src.compute.graph import least_cost_path

START = (77.58, 18.44)
END = (77.62, 18.44)
ORIGIN = ((START[0] + END[0]) / 2, (START[1] + END[1]) / 2)


def wall_terrain(gap_north: bool):
    """A 180 m wall at local x=0, with an optional gap north of y=250 m."""

    def elevation(lon: float, lat: float) -> float:
        x, y = to_local_meters((lon, lat), ORIGIN)
        if abs(x) <= 15.0:
            if gap_north and y >= 250.0:
                return 0.0
            return 180.0
        return 0.0

    return elevation


class LeastCostPathTests(unittest.TestCase):
    def test_path_uses_the_gap_when_wall_is_blocked(self) -> None:
        path = least_cost_path(
            wall_terrain(gap_north=True),
            START,
            END,
            slope_limit_deg=20.0,
            resolution_m=20.0,
            pad_m=700.0,
            max_cells=400,
        )

        self.assertFalse(path.relaxed)
        self.assertLessEqual(path.max_slope_deg, 20.01)
        local = [to_local_meters(point, ORIGIN) for point in path.coordinates]
        self.assertGreater(max(y for _, y in local), 200.0, "path should detour north through the gap")
        self.assertGreater(len(path.coordinates), 2)

    def test_wall_without_gap_flags_relaxed(self) -> None:
        path = least_cost_path(
            wall_terrain(gap_north=False),
            START,
            END,
            slope_limit_deg=20.0,
            resolution_m=20.0,
            pad_m=700.0,
            max_cells=400,
        )

        self.assertTrue(path.relaxed)
        self.assertGreater(path.max_slope_deg, 20.0)

    def test_flat_ground_is_cheap_and_direct(self) -> None:
        path = least_cost_path(
            lambda _lon, _lat: 0.0,
            START,
            END,
            slope_limit_deg=20.0,
            resolution_m=30.0,
            pad_m=300.0,
            max_cells=200,
        )

        self.assertFalse(path.relaxed)
        self.assertEqual(path.max_slope_deg, 0.0)
        self.assertLess(path.cost, 1.15 * haversine_m(START, END))
        self.assertEqual(path.coordinates[0], START)
        self.assertEqual(path.coordinates[-1], END)


if __name__ == "__main__":
    unittest.main()
