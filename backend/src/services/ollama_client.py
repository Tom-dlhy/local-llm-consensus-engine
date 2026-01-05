import logging
from typing import Any, AsyncGenerator

import httpx
import psutil

from src.config import get_settings

logger = logging.getLogger(__name__)


class OllamaError(Exception):
    """Ollama API error."""

    def __init__(self, message: str, status_code: int | None = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class OllamaClient:
    """Async HTTP client for Ollama API."""

    def __init__(self, base_url: str | None = None, timeout: int | None = None):
        """Initialize the Ollama client.

        Args:
            base_url: Ollama API URL (default from settings)
            timeout: Request timeout in seconds (default from settings)
        """
        settings = get_settings()
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.timeout = timeout or settings.generation_timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(self.timeout, connect=10.0),
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def __aenter__(self) -> "OllamaClient":
        """Context manager entry."""
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Context manager exit."""
        await self.close()

    # =========================================================================
    # Generation Methods
    # =========================================================================

    async def generate(
        self,
        model: str,
        prompt: str,
        *,
        system: str | None = None,
        format: str | None = None,
        options: dict[str, Any] | None = None,
        stream: bool = False,
    ) -> dict[str, Any]:
        """Generate a response from the model.

        Args:
            model: Model identifier (e.g., 'llama3.2:1b')
            prompt: The prompt to generate from
            system: Optional system prompt
            format: Response format ('json' for structured output)
            options: Ollama generation options
            stream: Whether to stream the response

        Returns:
            Response dict with 'response', 'done', 'total_duration', etc.
        """
        client = await self._get_client()

        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": stream,
        }

        if system:
            payload["system"] = system
        if format:
            payload["format"] = format
        if options:
            payload["options"] = options

        try:
            response = await client.post("/api/generate", json=payload)
            response.raise_for_status()
            return response.json()

        except httpx.TimeoutException as e:
            logger.error(f"Timeout generating with {model}: {e}")
            raise OllamaError(f"Generation timeout after {self.timeout}s", None) from e

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from Ollama: {e.response.status_code}")
            raise OllamaError(
                f"Ollama API error: {e.response.text}",
                e.response.status_code,
            ) from e

        except httpx.RequestError as e:
            logger.error(f"Request error to Ollama: {e}")
            raise OllamaError(f"Connection error: {e}") from e

    async def stream_generate(
        self,
        model: str,
        prompt: str,
        *,
        system: str | None = None,
        format: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Stream a response from the model.

        Yields:
            Response chunks with 'response' key containing partial content.
        """
        client = await self._get_client()

        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": True,
        }

        if system:
            payload["system"] = system
        if format:
            payload["format"] = format
        if options:
            payload["options"] = options

        try:
            async with client.stream("POST", "/api/generate", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        import json

                        yield json.loads(line)

        except httpx.TimeoutException as e:
            logger.error(f"Timeout streaming with {model}: {e}")
            raise OllamaError(f"Stream timeout after {self.timeout}s") from e

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error streaming from Ollama: {e.response.status_code}")
            raise OllamaError(
                f"Ollama API error: {e.response.text}",
                e.response.status_code,
            ) from e

    # =========================================================================
    # Health & Info Methods
    # =========================================================================

    async def health_check(self) -> bool:
        """Check if Ollama is responsive.

        Returns:
            True if Ollama is healthy, False otherwise.
        """
        try:
            settings = get_settings()
            client = httpx.AsyncClient(
                timeout=httpx.Timeout(settings.health_check_timeout),
            )
            async with client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            return False

    async def list_models(self) -> list[dict[str, Any]]:
        """List available models.

        Returns:
            List of model info dicts.
        """
        client = await self._get_client()

        try:
            response = await client.get("/api/tags")
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])

        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            raise OllamaError(f"Failed to list models: {e}") from e

    async def get_model_info(self, model: str) -> dict[str, Any]:
        """Get information about a specific model.

        Args:
            model: Model identifier

        Returns:
            Model info dict.
        """
        client = await self._get_client()

        try:
            response = await client.post("/api/show", json={"name": model})
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise OllamaError(f"Model not found: {model}", 404) from e
            raise OllamaError(f"Failed to get model info: {e.response.text}") from e

    @staticmethod
    def get_system_stats() -> dict[str, Any]:
        """Get current system resource usage.

        Returns:
            Dict with cpu_percent, memory_percent, memory_used_gb, memory_total_gb.
        """
        memory = psutil.virtual_memory()
        return {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": memory.percent,
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_total_gb": round(memory.total / (1024**3), 2),
        }
