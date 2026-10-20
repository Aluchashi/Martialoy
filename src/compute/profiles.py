"""Load the explorer profiles from TOML.

The TOML files are the single source of truth for the compute engine and for the
assumption table served by ``GET /api/profiles``. Display copy in the frontend
exists only as a fallback for the synthetic demo.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
import tomllib

PROFILE_DIR = Path(__file__).resolve().parent / "profiles"
PROFILE_IDS = ("rover", "human")

_MARS_FACT_SHEET = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html"

_CONSTANT_NAMES = {
    "system_mass_kg": "systemMassKg",
    "max_speed_mps": "maxSpeedMps",
    "base_power_w": "basePowerW",
    "drive_efficiency": "driveEfficiency",
    "max_slope_deg": "maxSlopeDeg",
    "energy_budget_wh": "energyBudgetWh",
    "duration_budget_h": "durationBudgetH",
    "speed_derate": "speedDerate",
    "min_speed_fraction": "minSpeedFraction",
    "spacing_m": "spacingM",
}


def _format_number(value: float) -> str:
    if float(value).is_integer():
        return f"{int(value):,}"
    return f"{value:g}"


def _shared_assumptions(constants: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "key": "gravity",
            "label": "Mars gravity",
            "value": "3.721",
            "unit": "m/s²",
            "source": "NASA Mars Fact Sheet",
            "source_url": _MARS_FACT_SHEET,
        },
        {
            "key": "spacing",
            "label": "Sample spacing",
            "value": _format_number(constants["spacingM"]),
            "unit": "m",
            "source": "Model setting",
        },
    ]


@lru_cache(maxsize=len(PROFILE_IDS))
def load_profile(profile_id: str) -> dict[str, Any]:
    """Return one profile in the JSON shape consumed by the web client."""

    if profile_id not in PROFILE_IDS:
        raise KeyError(f"Unknown profile: {profile_id}")

    path = PROFILE_DIR / f"{profile_id}.toml"
    with path.open("rb") as handle:
        raw = tomllib.load(handle)

    constants = {
        _CONSTANT_NAMES[key]: value
        for key, value in raw["constants"].items()
        if key in _CONSTANT_NAMES
    }
    missing = set(_CONSTANT_NAMES.values()) - set(constants)
    if missing:
        raise ValueError(f"{path} is missing constants: {sorted(missing)}")

    assumptions = [dict(row) for row in raw.get("assumptions", [])]
    assumptions.extend(_shared_assumptions(constants))

    profile: dict[str, Any] = {
        "id": raw["id"],
        "label": raw["label"],
        "tagline": raw["tagline"],
        "description": raw["description"],
        "constants": constants,
        "assumptions": assumptions,
        "formula": raw["formula"],
    }
    if "secondary" in raw:
        secondary = raw["secondary"]
        profile["secondary"] = {
            "label": secondary["label"],
            "basePowerW": secondary["base_power_w"],
            "efficiency": secondary["efficiency"],
            "unit": secondary.get("unit", "kcal"),
        }
    return profile


def load_profiles() -> list[dict[str, Any]]:
    return [load_profile(profile_id) for profile_id in PROFILE_IDS]


__all__ = ["PROFILE_DIR", "PROFILE_IDS", "load_profile", "load_profiles"]
