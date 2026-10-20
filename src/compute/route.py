"""Route sampling, slope, motion, energy and verdict.

This module is deliberately free of rasterio and FastAPI imports. Callers pass an
``elevation(lon, lat)`` callable, which may be a COG reader, a synthetic test
surface, or another DEM adapter. That keeps the synthetic-ramp test on exactly
the same code path as a real route.
"""

from __future__ import annotations

from math import atan2, degrees, isfinite
from typing import Any, Callable, Iterable

from .geo import MARS_GRAVITY, sample_polyline
from .profiles import load_profile

ElevationFn = Callable[[float, float], float | None]

KCAL_PER_WH = 0.860421


class RouteError(ValueError):
    """Raised when a route request cannot be evaluated."""


def _round(value: float, digits: int) -> float:
    factor = 10**digits
    return round(value * factor) / factor


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def _coerce_coordinates(
    coordinates: Iterable[Iterable[float]],
) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for raw in coordinates:
        pair = list(raw)
        if len(pair) != 2:
            raise RouteError("Each coordinate must be [lon, lat]")
        lon, lat = float(pair[0]), float(pair[1])
        if not (isfinite(lon) and isfinite(lat)):
            raise RouteError("Coordinates must be finite numbers")
        if not (-180.0 <= lon <= 180.0):
            raise RouteError("Longitude must be between -180 and 180")
        if not (-90.0 <= lat <= 90.0):
            raise RouteError("Latitude must be between -90 and 90")
        points.append((lon, lat))
    if len(points) < 2:
        raise RouteError("A route needs at least two coordinates")
    return points


def _fill_gaps(heights: list[float | None]) -> list[float]:
    """Forward-fill nodata for chart continuity, while keeping a gap flag.

    A fake cliff is worse than an honest gap, so the caller never computes a
    slope across a gap. Forward-filling only keeps the elevation polyline
    renderable; it does not invent climb or energy.
    """

    filled: list[float] = []
    last = 0.0
    for value in heights:
        if value is not None and isfinite(value):
            last = float(value)
        filled.append(last)
    return filled


def build_route_result(
    coordinates: Iterable[Iterable[float]],
    profile_id: str,
    elevation: ElevationFn,
    spacing_m: float | None = None,
    mode: str = "drawn",
) -> dict[str, Any]:
    """Sample a route and return the API contract payload.

    ``elevation`` returns metres above the Mars areoid, or ``None`` for nodata.
    """

    if mode not in {"drawn", "least_cost"}:
        raise RouteError("mode must be 'drawn' or 'least_cost'")

    profile = load_profile(profile_id)
    constants = profile["constants"]
    limit = float(constants["maxSlopeDeg"])
    spacing = float(spacing_m if spacing_m is not None else constants["spacingM"])
    if spacing <= 0:
        raise RouteError("spacing_m must be positive")

    points = _coerce_coordinates(coordinates)
    spaced = sample_polyline(points, spacing)
    if len(spaced) < 2:
        raise RouteError("Route is too short to sample")

    raw_heights: list[float | None] = []
    for point in spaced:
        try:
            value = elevation(point.lon, point.lat)
        except Exception as exc:  # A DEM read failure is a route failure.
            raise RouteError(f"Elevation sample failed: {exc}") from exc
        if value is None or not isfinite(float(value)):
            raw_heights.append(None)
        else:
            raw_heights.append(float(value))

    heights = _fill_gaps(raw_heights)
    gaps = sum(1 for value in raw_heights if value is None)

    samples: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    climb = 0.0
    descent = 0.0
    duration_s = 0.0
    max_slope = 0.0
    min_slope = 0.0

    for i, point in enumerate(spaced):
        slope = 0.0
        gap = raw_heights[i] is None
        if i > 0:
            ds = point.distance_m - spaced[i - 1].distance_m
            previous_gap = raw_heights[i - 1] is None
            if ds > 0.001 and not gap and not previous_gap:
                dh = heights[i] - heights[i - 1]
                slope = degrees(atan2(dh, ds))
                if dh > 0:
                    climb += dh
                else:
                    descent += -dh
            if not gap and not previous_gap and ds > 0.001:
                uphill = max(slope, 0.0)
                speed_factor = _clamp(
                    1.0 - float(constants["speedDerate"]) * (uphill / limit),
                    float(constants["minSpeedFraction"]),
                    1.0,
                )
                duration_s += ds / (float(constants["maxSpeedMps"]) * speed_factor)

        over = abs(slope) > limit
        sample = {
            "distance_m": point.distance_m,
            "lon": point.lon,
            "lat": point.lat,
            "elevation_m": heights[i],
            "slope_deg": slope,
            "over_limit": over,
        }
        if gap:
            sample["gap"] = True
        samples.append(sample)

        if over:
            segments.append(
                {
                    "index": i,
                    "start_m": spaced[i - 1].distance_m,
                    "end_m": point.distance_m,
                    "lon": point.lon,
                    "lat": point.lat,
                    "slope_deg": slope,
                    "over_by_deg": abs(slope) - limit,
                }
            )

        max_slope = max(max_slope, abs(slope))
        min_slope = min(min_slope, slope)

    distance = spaced[-1].distance_m
    energy_wh = (
        float(constants["basePowerW"]) * (duration_s / 3600.0)
        + (
            float(constants["systemMassKg"])
            * MARS_GRAVITY
            * climb
        )
        / (float(constants["driveEfficiency"]) * 3600.0)
    )

    duration_h = duration_s / 3600.0
    slope_pass = len(segments) == 0
    energy_pass = energy_wh <= float(constants["energyBudgetWh"])
    duration_pass = duration_h <= float(constants["durationBudgetH"])

    worst = max(segments, key=lambda segment: segment["over_by_deg"], default=None)
    checks: list[dict[str, Any]] = [
        {
            "id": "slope",
            "label": "Slope limit",
            "value": _round(max_slope, 1),
            "limit": limit,
            "unit": "°",
            "pass": slope_pass,
            "detail": (
                f"Every {spacing:g} m segment is at or below {limit:.1f}°"
                if slope_pass
                else (
                    f"{len(segments)} segment"
                    f"{'' if len(segments) == 1 else 's'} over limit · "
                    f"worst +{_round(float(worst['over_by_deg']), 1)}° at "
                    f"{float(worst['start_m']) / 1000.0:.2f} km"
                )
            ),
        },
        {
            "id": "energy",
            "label": "Energy allocation",
            "value": _round(energy_wh, 1),
            "limit": float(constants["energyBudgetWh"]),
            "unit": "Wh",
            "pass": energy_pass,
            "detail": (
                f"{round(energy_wh / float(constants['energyBudgetWh']) * 100):.0f}% "
                f"of the {float(constants['energyBudgetWh']):,.0f} Wh allocation"
            ),
        },
        {
            "id": "duration",
            "label": "Time allocation",
            "value": _round(duration_h, 2),
            "limit": float(constants["durationBudgetH"]),
            "unit": "h",
            "pass": duration_pass,
            "detail": (
                f"{round(duration_h / float(constants['durationBudgetH']) * 100):.0f}% "
                f"of the {float(constants['durationBudgetH']):g} h allocation"
            ),
        },
    ]

    warnings: list[str] = []
    if gaps:
        warnings.append(
            f"{gaps} elevation sample{'s' if gaps != 1 else ''} hit DEM nodata; "
            "slope and climb are not inferred across the gap."
        )
    if slope_pass and max_slope > limit - 1.5:
        warnings.append(f"Slope margin is only {_round(limit - max_slope, 1)}°.")
    if energy_pass and energy_wh > float(constants["energyBudgetWh"]) * 0.8:
        warnings.append(
            f"Energy uses {round(energy_wh / float(constants['energyBudgetWh']) * 100):.0f}% "
            "of the allocation."
        )
    if duration_pass and duration_h > float(constants["durationBudgetH"]) * 0.8:
        warnings.append(
            f"Duration uses {round(duration_h / float(constants['durationBudgetH']) * 100):.0f}% "
            "of the allocation."
        )
    if mode == "least_cost" and not slope_pass:
        warnings.append("No path within the slope limit was found; the path is relaxed.")

    energy_secondary = None
    secondary = profile.get("secondary")
    if secondary:
        metabolic_wh = (
            float(secondary["basePowerW"]) * (duration_s / 3600.0)
            + (
                float(constants["systemMassKg"])
                * MARS_GRAVITY
                * climb
            )
            / (float(secondary["efficiency"]) * 3600.0)
        )
        energy_secondary = {
            "label": secondary["label"],
            "value_kcal": metabolic_wh * KCAL_PER_WH,
        }

    passed = slope_pass and energy_pass and duration_pass

    return {
        "profile": profile_id,
        "mode": mode,
        "distance_m": distance,
        "climb_m": climb,
        "descent_m": descent,
        "duration_s": duration_s,
        "energy_wh": energy_wh,
        "energy_secondary": energy_secondary,
        "max_slope_deg": max_slope,
        "min_slope_deg": min_slope,
        "slope_limit_deg": limit,
        "pass": passed,
        "spacing_m": spacing,
        "sample_count": len(samples),
        "samples": samples,
        "segments": segments,
        "checks": checks,
        "assumptions": profile["assumptions"],
        "warnings": warnings,
        "contingency": {
            "available": (not passed) and mode == "drawn",
            "reason": (
                "Least-cost detour can be computed"
                if (not passed) and mode == "drawn"
                else None
            ),
        },
    }


__all__ = ["ElevationFn", "RouteError", "build_route_result"]
