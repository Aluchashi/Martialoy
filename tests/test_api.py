"""Contract smoke tests for the FastAPI surface.

Skipped on a bare Python install without FastAPI. The route test patches the DEM
loader with a flat synthetic surface, so it still exercises the request/response
contract without any rasterio or Mars cache payload.
"""

from __future__ import annotations

import importlib.util
import unittest
from unittest.mock import patch

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_TESTCLIENT = importlib.util.find_spec("httpx2") is not None

if HAS_FASTAPI and HAS_TESTCLIENT:
    from fastapi.testclient import TestClient

    from src.compute import api


class FakeDem:
    def sample(self, _lon: float, _lat: float) -> float:
        return 0.0

    def close(self) -> None:
        return None


@unittest.skipUnless(
    HAS_FASTAPI and HAS_TESTCLIENT,
    "FastAPI + httpx2 are not installed",
)
class ApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(api.app)

    def test_health_and_profiles(self) -> None:
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["status"], "ok")

        profiles = self.client.get("/api/profiles")
        self.assertEqual(profiles.status_code, 200)
        self.assertEqual([row["id"] for row in profiles.json()], ["rover", "human"])
        self.assertIn("constants", profiles.json()[0])
        self.assertTrue(profiles.json()[0]["assumptions"])

    def test_route_contract_with_flat_dem(self) -> None:
        with patch.object(api, "load_region_dem", return_value=FakeDem()):
            response = self.client.post(
                "/api/route",
                json={
                    "region": "jezero",
                    "profile": "rover",
                    "spacing_m": 30,
                    "coordinates": [[77.58, 18.44], [77.60, 18.44]],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        for key in (
            "profile",
            "distance_m",
            "climb_m",
            "duration_s",
            "energy_wh",
            "max_slope_deg",
            "pass",
            "samples",
            "checks",
            "assumptions",
        ):
            self.assertIn(key, body)
        self.assertTrue(body["checks"])
        self.assertTrue(body["assumptions"])

    def test_contingency_contract_with_flat_dem(self) -> None:
        with patch.object(api, "load_region_dem", return_value=FakeDem()):
            response = self.client.post(
                "/api/contingency",
                json={
                    "region": "jezero",
                    "profile": "rover",
                    "start": [77.58, 18.44],
                    "end": [77.59, 18.44],
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("coordinates", body)
        self.assertIn("result", body)
        self.assertEqual(body["result"]["mode"], "least_cost")
        self.assertGreaterEqual(len(body["coordinates"]), 2)

    def test_unknown_profile_rejected(self) -> None:
        response = self.client.post(
            "/api/route",
            json={"profile": "alien", "coordinates": [[77.58, 18.44], [77.60, 18.44]]},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
