"""Council Routes (PC 1 - Master).

Provides endpoints for orchestrating the LLM Council:
- POST /api/council/query: Start a new council deliberation
- GET /api/council/session/{id}: Get session status
- GET /api/council/models: List recommended models
- WebSocket /api/council/ws/{id}: Stream responses in real-time
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from src.config import get_settings
from src.models import CouncilRequest, CouncilSession
from src.services.council import CouncilService
from src.services.ollama_client import OllamaClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/council", tags=["Council"])

# Global council service instance
_council_service: CouncilService | None = None


def get_council_service() -> CouncilService:
    """Get or create the council service singleton."""
    global _council_service
    if _council_service is None:
        _council_service = CouncilService()
    return _council_service


# =============================================================================
# Recommended Models
# =============================================================================

RECOMMENDED_MODELS = [
    {
        "name": "llama3.2:1b",
        "display_name": "Llama 3.2",
        "size": "~1.3 GB",
        "description": "Excellent pour la notation (Stage 2)",
        "recommended_role": "reviewer",
    },
    {
        "name": "qwen2.5:0.5b",
        "display_name": "Qwen 2.5",
        "size": "~350 MB",
        "description": "Ultra rapide pour les opinions simples",
        "recommended_role": "opinions",
    },
    {
        "name": "gemma2:2b",
        "display_name": "Gemma 2",
        "size": "~1.6 GB",
        "description": "Plus précis mais un peu plus lourd",
        "recommended_role": "expert",
    },
    {
        "name": "phi3.5:latest",
        "display_name": "Phi-3.5 Mini",
        "size": "~2.2 GB",
        "description": "Excellent pour le Chairman (Stage 3)",
        "recommended_role": "chairman",
    },
    {
        "name": "tinyllama",
        "display_name": "TinyLlama",
        "size": "~600 MB",
        "description": "Backup léger si ressources limitées",
        "recommended_role": "backup",
    },
]


@router.get("/models")
async def get_available_models() -> dict[str, Any]:
    """Get list of recommended and available models."""
    client = OllamaClient()
    try:
        installed = await client.list_models()
        installed_names = {m.get("name", "").split(":")[0] for m in installed}

        # Mark which recommended models are installed
        models = []
        for model in RECOMMENDED_MODELS:
            base_name = model["name"].split(":")[0]
            models.append({
                **model,
                "installed": base_name in installed_names or model["name"] in {
                    m.get("name") for m in installed
                },
            })

        return {
            "recommended": models,
            "installed": [m.get("name") for m in installed],
        }
    finally:
        await client.close()


# =============================================================================
# Council Workflow
# =============================================================================


@router.post("/query", response_model=CouncilSession)
async def start_council(request: CouncilRequest) -> CouncilSession:
    """Start a new council deliberation.

    This runs the complete 3-stage workflow:
    1. Stage 1 - First Opinions: Each agent responds to the query
    2. Stage 2 - Review & Ranking: Each agent ranks the other responses
    3. Stage 3 - Chairman Synthesis: Final answer from the Chairman

    Returns the complete session with all stages' results.
    """
    settings = get_settings()
    service = get_council_service()

    # Determine worker URL (for distributed mode)
    worker_url = settings.worker_url if settings.is_master else None

    logger.info(
        f"Starting council with {len(request.selected_agents)} agents. "
        f"Worker URL: {worker_url or 'local'}"
    )

    try:
        session = await service.run_council(request, worker_url=worker_url)
        return session

    except Exception as e:
        logger.exception("Council workflow failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}", response_model=CouncilSession)
async def get_session(session_id: str) -> CouncilSession:
    """Get the status and results of a council session."""
    service = get_council_service()
    session = service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


# =============================================================================
# WebSocket Streaming
# =============================================================================


@router.websocket("/ws/{session_id}")
async def council_websocket(websocket: WebSocket, session_id: str):
    """Stream council progress in real-time.

    The client connects before starting the query, then receives
    updates as each stage completes.

    Message format:
    {
        "type": "stage_start" | "stage_complete" | "error" | "complete",
        "stage": "opinions" | "review" | "synthesis",
        "data": { ... stage-specific data ... }
    }
    """
    await websocket.accept()
    service = get_council_service()

    try:
        # Wait for session to be created
        session = None
        for _ in range(30):  # Wait up to 30 seconds
            session = service.get_session(session_id)
            if session:
                break
            await asyncio.sleep(1)

        if not session:
            await websocket.send_json({
                "type": "error",
                "message": "Session not found",
            })
            await websocket.close()
            return

        # Send initial state
        await websocket.send_json({
            "type": "session_started",
            "session_id": session.session_id,
            "stage": session.stage.value,
        })

        # Poll for updates
        last_stage = session.stage
        while session.stage.value not in ("complete", "error"):
            await asyncio.sleep(0.5)
            session = service.get_session(session_id)

            if session and session.stage != last_stage:
                # Stage changed - send update
                await websocket.send_json({
                    "type": "stage_update",
                    "stage": session.stage.value,
                    "opinions_count": len(session.opinions),
                    "reviews_count": len(session.reviews),
                    "has_final_answer": session.final_answer is not None,
                })
                last_stage = session.stage

        # Send final result
        if session:
            await websocket.send_json({
                "type": "complete",
                "session": session.model_dump(mode="json"),
            })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
            })
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
