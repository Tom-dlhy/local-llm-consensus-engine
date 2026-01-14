import argparse
import logging

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        settings: Optional settings override (for testing)

    Returns:
        Configured FastAPI application
    """
    if settings is None:
        settings = get_settings()

    app = FastAPI(
        title="LLM Council Backend",
        description=(
            "Distributed LLM Consensus Engine - "
            f"Running as {settings.role.value.upper()}"
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from src.api import health_router

    app.include_router(health_router)

    if settings.is_worker:
        from src.api import worker_router

        app.include_router(worker_router)
        logging.info("Worker mode: /api/generate endpoints enabled")

    if settings.is_master:
        from src.api import council_router

        app.include_router(council_router)
        logging.info("Master mode: /api/council endpoints enabled")

    @app.on_event("startup")
    async def startup_event():
        logging.info(
            f"🚀 LLM Council Backend started in {settings.role.value.upper()} mode"
        )
        logging.info(f"   Ollama URL: {settings.ollama_base_url}")
        if settings.is_master:
            logging.info(f"   Worker URL: {settings.worker_url}")

    return app


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="LLM Council Backend Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--role",
        type=str,
        choices=["master", "worker"],
        default=None,
        help="Service role: master (PC1) or worker (PC2)",
    )

    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Host to bind to (default: 0.0.0.0)",
    )

    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Port to listen on (default: 8000)",
    )

    parser.add_argument(
        "--worker-url",
        type=str,
        default=None,
        help="Worker service URL (master mode only)",
    )

    parser.add_argument(
        "--ollama-url",
        type=str,
        default=None,
        help="Ollama API URL (default: http://localhost:11434)",
    )

    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )

    parser.add_argument(
        "--log-level",
        type=str,
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default=None,
        help="Logging level",
    )

    return parser.parse_args()


def main() -> None:
    """Main entry point."""
    args = parse_args()

    # Configure logging
    log_level = args.log_level or "INFO"
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Override settings from CLI args
    import os

    if args.role:
        os.environ["ROLE"] = args.role
    if args.host:
        os.environ["HOST"] = args.host
    if args.port:
        os.environ["PORT"] = str(args.port)
    if args.worker_url:
        os.environ["WORKER_URL"] = args.worker_url
    if args.ollama_url:
        os.environ["OLLAMA_BASE_URL"] = args.ollama_url

    # Clear cached settings to pick up env overrides
    get_settings.cache_clear()
    settings = get_settings()

    # Validate configuration
    if settings.is_master and settings.worker_url == "http://localhost:8000":
        logging.warning(
            "⚠️  Master mode with default worker URL. "
            "Use --worker-url to specify the Worker (PC2) address."
        )

    # Create and run the application
    app = create_app(settings)

    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=args.reload,
        log_level=log_level.lower(),
    )


if __name__ == "__main__":
    main()
