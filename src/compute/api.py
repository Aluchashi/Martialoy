"""FastAPI surface for the local Martian route engine.

Run from the repository root:

    uvicorn src.compute.api:app --reload

The app never calls a third-party tile or terrain service. It reads the COG and
PMTiles under ``cache/mars`` and serves the built web client from
``src/web/dist`` when that directory exists.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .dem import DEFAULT_CACHE_DIR, DemUnavailable, load_region_dem, read_manifest
from .graph import NoPathError, least_cost_path
from .profiles import PROFILE_IDS, load_profile, load_profiles
from .route import RouteError, build_route_result

ROOT = Path(__file__).resolve().parents[2]
WEB_DIST = ROOT / "src" / "web" / "dist"

app = FastAPI(
    title="Martialoy compute engine",
    version="0.1.0",
    description="Local-only Mars traverse sampling, survival verdict and least-cost contingency.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RouteRequest(BaseModel):
    region: str = "jezero"
    profile: str = "rover"
    spacing_m: float | None = Field(default=None, gt=0, le=500)
    mode: Literal["drawn", "least_cost"] = "drawn"
    coordinates: list[tuple[float, float]]


class ContingencyRequest(BaseModel):
    region: str = "jezero"
    profile: str = "rover"
    start: tuple[float, float]
    end: tuple[float, float]
    resolution_m: float = Field(default=25.0, gt=5, le=200)
    max_cells: int = Field(default=1200, ge=50, le=2000)


def _validate_profile(profile_id: str) -> None:
    if profile_id not in PROFILE_IDS:
        raise HTTPException(status_code=422, detail=f"Unknown profile: {profile_id}")


@app.get("/api/health")
def health() -> dict[str, object]:
    dem_available = False
    region = "jezero"
    label = "Jezero Crater"
    warning: str | None = None
    try:
        manifest = read_manifest()
        region = manifest.region
        label = manifest.label
        dem_available = manifest.dem_file.exists()
        if not dem_available:
            warning = f"DEM payload missing: {manifest.dem_file.name}"
    except DemUnavailable as exc:
        warning = str(exc)

    return {
        "status": "ok",
        "region": region,
        "label": label,
        "dem_available": dem_available,
        "profiles": list(PROFILE_IDS),
        "warning": warning,
    }


@app.get("/api/profiles")
def profiles() -> list[dict[str, object]]:
    return load_profiles()


@app.post("/api/route")
def route(request: RouteRequest) -> dict[str, object]:
    _validate_profile(request.profile)
    if request.mode == "least_cost":
        raise HTTPException(
            status_code=422,
            detail="Use /api/contingency for least_cost mode; /api/route judges a drawn line.",
        )

    try:
        dem = load_region_dem(request.region)
    except DemUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        return build_route_result(
            coordinates=request.coordinates,
            profile_id=request.profile,
            elevation=dem.sample,
            spacing_m=request.spacing_m,
            mode=request.mode,
        )
    except RouteError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        dem.close()


@app.post("/api/contingency")
def contingency(request: ContingencyRequest) -> dict[str, object]:
    _validate_profile(request.profile)
    profile = load_profile(request.profile)
    limit = float(profile["constants"]["maxSlopeDeg"])

    try:
        dem = load_region_dem(request.region)
    except DemUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        path = least_cost_path(
            dem.sample,
            request.start,
            request.end,
            limit,
            resolution_m=request.resolution_m,
            max_cells=request.max_cells,
        )
        result = build_route_result(
            coordinates=path.coordinates,
            profile_id=request.profile,
            elevation=dem.sample,
            spacing_m=profile["constants"]["spacingM"],
            mode="least_cost",
        )
        return {
            "result": result,
            "coordinates": path.coordinates,
            "relaxed": path.relaxed,
            "cells": path.cells,
            "resolution_m": path.resolution_m,
            "cost": path.cost,
        }
    except (NoPathError, RouteError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        dem.close()


# The PMTiles manifest and payload. Mounted before "/" so /mars is not swallowed
# by the SPA static handler.
app.mount("/mars", StaticFiles(directory=str(DEFAULT_CACHE_DIR)), name="mars")

if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")


__all__ = ["app"]
