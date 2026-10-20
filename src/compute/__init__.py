"""Martialoy compute engine.

The engine is split into three layers:

- ``geo``     pure spherical geometry and fixed-spacing resampling
- ``route``   elevation sampling, slope, motion and energy, verdict
- ``graph``   least-cost contingency path over a DEM grid

``dem`` is the optional rasterio adapter. The pure layers have no rasterio or
FastAPI dependency, so the synthetic-ramp tests run on a bare Python install.
"""

from .route import build_route_result

__all__ = ["build_route_result"]
__version__ = "0.1.0"
