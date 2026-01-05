from .council_routes import router as council_router
from .health_routes import router as health_router
from .worker_routes import router as worker_router

__all__ = [
    "council_router",
    "health_router",
    "worker_router",
]
