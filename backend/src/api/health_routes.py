from fastapi import APIRouter, HTTPException

from src.services.ollama_client import OllamaClient

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
@router.get("/")
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "service": "llm-council-backend",
    }


@router.get("/ollama")
async def ollama_health() -> dict:
    """Check Ollama connection status."""
    client = OllamaClient()
    try:
        is_healthy = await client.health_check()
        return {
            "status": "ok" if is_healthy else "error",
            "ollama_url": client.base_url,
            "connected": is_healthy,
        }
    finally:
        await client.close()


@router.get("/system")
async def system_stats() -> dict:
    """Get system resource usage (CPU, RAM)."""
    stats = OllamaClient.get_system_stats()
    return {
        "status": "ok",
        **stats,
    }


@router.get("/models")
async def list_models() -> dict:
    """List available Ollama models."""
    client = OllamaClient()
    try:
        models = await client.list_models()
        return {
            "status": "ok",
            "models": [
                {
                    "name": m.get("name"),
                    "size": m.get("size"),
                    "modified_at": m.get("modified_at"),
                }
                for m in models
            ],
            "count": len(models),
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to list models: {e}")
    finally:
        await client.close()
