"""Least-cost contingency path over a DEM grid.

The graph is an 8-neighbour grid in local east/north metres. Edge cost is

    ds * (1 + k_slope * (|slope| / slope_limit)^2)

with edges above the profile slope limit removed. If no path exists, the search
is repeated with those edges allowed and the result is flagged ``relaxed``. The
returned polyline is then fed through the same route sampler as a hand-drawn
route, so the contingency card uses the same verdict code.
"""

from __future__ import annotations

from dataclasses import dataclass
from heapq import heappop, heappush
from math import atan2, ceil, degrees, hypot
from typing import Callable

from .geo import from_local_meters, to_local_meters

ElevationFn = Callable[[float, float], float | None]
RoughnessFn = Callable[[float, float], float]


class NoPathError(RuntimeError):
    """Raised when even a relaxed search cannot connect start and end."""


@dataclass(frozen=True)
class LeastCostPath:
    coordinates: list[tuple[float, float]]
    relaxed: bool
    cells: int
    resolution_m: float
    cost: float
    max_slope_deg: float


def least_cost_path(
    elevation: ElevationFn,
    start: tuple[float, float],
    end: tuple[float, float],
    slope_limit_deg: float,
    *,
    resolution_m: float = 30.0,
    pad_m: float = 1000.0,
    max_cells: int = 1200,
    slope_weight: float = 6.0,
    roughness: RoughnessFn | None = None,
) -> LeastCostPath:
    """Find the cheapest path between two lon/lat points.

    ``elevation`` may return ``None`` for nodata; those cells are impassable.
    ``roughness`` is an optional multiplier source (0 = smooth, 1 = rough); the
    MVP passes ``None``.
    """

    if resolution_m <= 0:
        raise ValueError("resolution_m must be positive")
    if max_cells < 3:
        raise ValueError("max_cells must be at least 3")

    origin = ((start[0] + end[0]) / 2.0, (start[1] + end[1]) / 2.0)
    sx, sy = to_local_meters(start, origin)
    ex, ey = to_local_meters(end, origin)

    min_x = min(sx, ex) - pad_m
    max_x = max(sx, ex) + pad_m
    min_y = min(sy, ey) - pad_m
    max_y = max(sy, ey) + pad_m

    width = max(max_x - min_x, resolution_m)
    height = max(max_y - min_y, resolution_m)
    resolution = resolution_m
    nx = max(3, ceil(width / resolution) + 1)
    ny = max(3, ceil(height / resolution) + 1)
    if nx > max_cells or ny > max_cells:
        resolution = max(width, height) / (max_cells - 1)
        nx = max(3, ceil(width / resolution) + 1)
        ny = max(3, ceil(height / resolution) + 1)

    # Ensure the requested bbox is fully covered after rounding up.
    max_x = min_x + (nx - 1) * resolution
    max_y = min_y + (ny - 1) * resolution

    heights: list[float | None] = [None] * (nx * ny)
    for j in range(ny):
        for i in range(nx):
            lon, lat = from_local_meters(min_x + i * resolution, min_y + j * resolution, origin)
            value = elevation(lon, lat)
            if value is not None:
                heights[j * nx + i] = float(value)

    start_i = _clamp_int(round((sx - min_x) / resolution), 0, nx - 1)
    start_j = _clamp_int(round((sy - min_y) / resolution), 0, ny - 1)
    end_i = _clamp_int(round((ex - min_x) / resolution), 0, nx - 1)
    end_j = _clamp_int(round((ey - min_y) / resolution), 0, ny - 1)
    start_idx = start_j * nx + start_i
    end_idx = end_j * nx + end_i

    if heights[start_idx] is None or heights[end_idx] is None:
        raise NoPathError("Start or end falls on DEM nodata")

    # Neighbour order is fixed so ties reproduce across runs.
    neighbours = tuple(
        (di, dj)
        for dj in (-1, 0, 1)
        for di in (-1, 0, 1)
        if not (di == 0 and dj == 0)
    )

    def search(block_over_limit: bool) -> tuple[bool, list[float], list[int]]:
        count = nx * ny
        dist = [float("inf")] * count
        prev = [-1] * count
        settled = bytearray(count)
        heap: list[tuple[float, int, int]] = []
        tie = 0
        dist[start_idx] = 0.0
        heappush(heap, (0.0, tie, start_idx))

        while heap:
            current_cost, _, current = heappop(heap)
            if settled[current]:
                continue
            settled[current] = 1
            if current == end_idx:
                return True, dist, prev

            ci = current % nx
            cj = current // nx
            current_height = heights[current]
            if current_height is None:
                continue

            for di, dj in neighbours:
                ni = ci + di
                nj = cj + dj
                if ni < 0 or nj < 0 or ni >= nx or nj >= ny:
                    continue
                nxt = nj * nx + ni
                if settled[nxt]:
                    continue
                next_height = heights[nxt]
                if next_height is None:
                    continue

                ds = resolution * hypot(di, dj)
                slope = degrees(atan2(next_height - current_height, ds))
                if block_over_limit and abs(slope) > slope_limit_deg:
                    continue

                penalty = 1.0 + slope_weight * (abs(slope) / slope_limit_deg) ** 2
                if roughness is not None:
                    lon, lat = from_local_meters(
                        min_x + ni * resolution,
                        min_y + nj * resolution,
                        origin,
                    )
                    penalty *= 1.0 + max(0.0, roughness(lon, lat))
                candidate = current_cost + ds * penalty
                if candidate < dist[nxt]:
                    dist[nxt] = candidate
                    prev[nxt] = current
                    tie += 1
                    heappush(heap, (candidate, tie, nxt))

        return False, dist, prev

    reached, dist, prev = search(True)
    relaxed = False
    if not reached:
        reached, dist, prev = search(False)
        relaxed = True
    if not reached:
        raise NoPathError("No path connects start and end inside the search area")

    indices: list[int] = []
    cursor = end_idx
    limit = nx * ny
    while cursor != -1 and len(indices) <= limit:
        indices.append(cursor)
        if cursor == start_idx:
            break
        cursor = prev[cursor]
    indices.reverse()
    if not indices or indices[0] != start_idx:
        raise NoPathError("Path reconstruction failed")

    coordinates: list[tuple[float, float]] = []
    max_slope = 0.0
    previous_height: float | None = None
    previous_xy: tuple[float, float] | None = None
    for index in indices:
        i = index % nx
        j = index // nx
        x = min_x + i * resolution
        y = min_y + j * resolution
        lon, lat = from_local_meters(x, y, origin)
        coordinates.append((lon, lat))
        height = heights[index]
        if height is not None and previous_height is not None and previous_xy is not None:
            ds = hypot(x - previous_xy[0], y - previous_xy[1])
            if ds > 0:
                slope = abs(degrees(atan2(height - previous_height, ds)))
                max_slope = max(max_slope, slope)
        previous_height = height
        previous_xy = (x, y)

    if coordinates:
        coordinates[0] = start
        coordinates[-1] = end
    else:  # pragma: no cover - defensive
        coordinates = [start, end]

    return LeastCostPath(
        coordinates=_dedupe(coordinates),
        relaxed=relaxed,
        cells=nx * ny,
        resolution_m=resolution,
        cost=dist[end_idx],
        max_slope_deg=max_slope,
    )


def _clamp_int(value: int, low: int, high: int) -> int:
    return min(high, max(low, value))


def _dedupe(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for point in points:
        if not out or abs(out[-1][0] - point[0]) > 1e-9 or abs(out[-1][1] - point[1]) > 1e-9:
            out.append(point)
    return out


__all__ = ["LeastCostPath", "NoPathError", "least_cost_path"]
