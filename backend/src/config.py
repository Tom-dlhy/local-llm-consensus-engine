from enum import Enum
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Role(str, Enum):
    """Service role in the distributed architecture."""

    MASTER = "master"  # PC1: Orchestration + Chairman
    WORKER = "worker"  # PC2: LLM Inference


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Role Configuration
    role: Role = Field(default=Role.WORKER, description="Service role: master or worker")

    # Server Configuration
    host: str = Field(default="0.0.0.0", description="Server bind address")
    port: int = Field(default=8000, description="Server port")

    # Ollama Configuration
    ollama_base_url: str = Field(
        default="http://localhost:11434",
        description="Ollama API base URL",
    )

    # Worker URL (Master only)
    worker_url: str = Field(
        default="http://localhost:8000",
        description="Worker service URL for LLM inference",
    )

    # Chairman Model (Master only)
    chairman_model: str = Field(
        default="phi3.5:mini",
        description="Model used for Chairman synthesis",
    )

    # Timeouts
    generation_timeout: int = Field(
        default=120,
        description="Timeout in seconds for LLM generation requests",
    )
    health_check_timeout: int = Field(
        default=5,
        description="Timeout in seconds for health check requests",
    )

    # Logging
    log_level: str = Field(default="INFO", description="Logging level")

    @property
    def is_master(self) -> bool:
        """Check if running as master (PC1)."""
        return self.role == Role.MASTER

    @property
    def is_worker(self) -> bool:
        """Check if running as worker (PC2)."""
        return self.role == Role.WORKER


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
