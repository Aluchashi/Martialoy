"""Spherical Mars geometry and fixed-spacing polyline sampling.

All horizontal maths use a sphere of radius 3,389,500 m. At Jezero scale the
regional error of the equirectangular approximation is well below the DEM
resolution, and using one documented model is more useful than mixing geodesic
algorithms that disagree at the metre level.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, degrees, floor, radians, sin, sqrt

MARS_RADIUS_M = 3_389_500.0
MARS_GRAVITY = 3.721
DEG = radians(1.0)
RAD = degrees(1.0)


@dataclass(frozen=True)
class SampledPoint:
    lon: float
    lat: float
    distance_m: float


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance on the Mars sphere, in metres."""

    d_lat = radians(b[1] - a[1])
    d_lon = radians(b[0] - a[0])
    lat1 = radians(a[1])
    lat2 = radians(b[1])
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lon / 2) ** 2
    return 2 * MARS_RADIUS_M * asin(min(1.0, sqrt(h)))


def to_local_meters(
    point: tuple[float, float], origin: tuple[float, float]
) -> tuple[float, float]:
    """Local east/north metres relative to an origin (equirectangular)."""

    x = (point[0] - origin[0]) * DEG * MARS_RADIUS_M * cos(radians(origin[1]))
    y = (point[1] - origin[1]) * DEG * MARS_RADIUS_M
    return x, y


def from_local_meters(
    x: float, y: float, origin: tuple[float, float]
) -> tuple[float, float]:
    """Inverse of :func:`to_local_meters`."""

    lon = origin[0] + (x / (MARS_RADIUS_M * cos(radians(origin[1])))) * RAD
    lat = origin[1] + (y / MARS_RADIUS_M) * RAD
    return lon, lat


def sample_polyline(
    points: list[tuple[float, float]] | tuple[tuple[float, float], ...],
    spacing_m: float,
) -> list[SampledPoint]:
    """Resample a polyline at a fixed arc-length spacing.

    The step is ``total / floor(total / spacing)`` so the spacing is as close to
    the requested value as the line length allows, and the final vertex is always
    represented. Vertex interpolation is linear in lon/lat, which is exact enough
    for a single regional traverse.
    """

    if len(points) < 2:
        return []
    if spacing_m <= 0:
        raise ValueError("spacing_m must be positive")

    lengths: list[float] = []
    total = 0.0
    for i in range(len(points) - 1):
        length = haversine_m(points[i], points[i + 1])
        lengths.append(length)
        total += length

    if total < 0.5:
        return [SampledPoint(points[0][0], points[0][1], 0.0)]

    # The epsilon keeps an exact multiple from flooring to one fewer step after
    # floating-point round-trips through degrees.
    steps = max(1, floor(total / spacing_m + 1e-6))
    step = total / steps
    out: list[SampledPoint] = []

    seg = 0
    seg_start = 0.0
    for k in range(steps + 1):
        target = k * step
        while seg < len(lengths) - 1 and seg_start + lengths[seg] < target - 1e-6:
            seg_start += lengths[seg]
            seg += 1
        a = points[seg]
        b = points[seg + 1]
        length = lengths[seg]
        t = 0.0 if length <= 0 else min(1.0, max(0.0, (target - seg_start) / length))
        out.append(
            SampledPoint(
                lon=a[0] + (b[0] - a[0]) * t,
                lat=a[1] + (b[1] - a[1]) * t,
                distance_m=target,
            )
        )

    last = points[-1]
    tail = out[-1]
    if haversine_m((tail.lon, tail.lat), last) > 0.5:
        out.append(SampledPoint(last[0], last[1], total))
    return out


__all__ = [
    "DEG",
    "MARS_GRAVITY",
    "MARS_RADIUS_M",
    "RAD",
    "SampledPoint",
    "from_local_meters",
    "haversine_m",
    "sample_polyline",
    "to_local_meters",
]
