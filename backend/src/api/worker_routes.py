import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.models import GenerateRequest, GenerateResponse
from src.services.ollama_client import OllamaClient, OllamaError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Worker"])


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest) -> GenerateResponse:
    """Generate a response from a specific Ollama model.

    This endpoint is called by the Master (PC 1) to get agent opinions.
    """
    client = OllamaClient()
    try:
        result = await client.generate(
            model=request.model,
            prompt=request.prompt,
            system=request.system,
            format=request.format,
            options=request.options,
        )

        return GenerateResponse(
            model=request.model,
            content=result.get("response", ""),
            done=result.get("done", True),
            total_duration=result.get("total_duration", 0),
            eval_count=result.get("eval_count", 0),
        )

    except OllamaError as e:
        logger.error(f"Generation failed: {e.message}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=e.message,
        )
    finally:
        await client.close()


class BatchGenerateRequest(BaseModel):
    """Request for batch generation."""

    requests: list[GenerateRequest] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="List of generation requests to process in parallel",
    )


class BatchGenerateResponse(BaseModel):
    """Response from batch generation."""

    results: list[GenerateResponse | dict[str, Any]] = Field(
        ...,
        description="List of results (GenerateResponse or error dict)",
    )
    success_count: int
    error_count: int


@router.post("/generate/batch", response_model=BatchGenerateResponse)
async def generate_batch(request: BatchGenerateRequest) -> BatchGenerateResponse:
    """Generate multiple responses in parallel.

    Useful for Stage 1 when all agent opinions are needed at once.
    """
    client = OllamaClient()

    async def process_one(req: GenerateRequest) -> GenerateResponse | dict[str, Any]:
        try:
            result = await client.generate(
                model=req.model,
                prompt=req.prompt,
                system=req.system,
                format=req.format,
                options=req.options,
            )
            return GenerateResponse(
                model=req.model,
                content=result.get("response", ""),
                done=result.get("done", True),
                total_duration=result.get("total_duration", 0),
                eval_count=result.get("eval_count", 0),
            )
        except OllamaError as e:
            logger.error(f"Batch generation failed for {req.model}: {e.message}")
            return {"error": e.message, "model": req.model}

    try:
        # Process all requests in parallel
        results = await asyncio.gather(*[process_one(r) for r in request.requests])

        success_count = sum(1 for r in results if isinstance(r, GenerateResponse))
        error_count = len(results) - success_count

        return BatchGenerateResponse(
            results=results,
            success_count=success_count,
            error_count=error_count,
        )
    finally:
        await client.close()
