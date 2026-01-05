from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class SessionStage(str, Enum):
    """Current stage in the council workflow."""

    PENDING = "pending"
    OPINIONS = "opinions"  # Stage 1: Collecting first opinions
    REVIEW = "review"  # Stage 2: Peer review and ranking
    SYNTHESIS = "synthesis"  # Stage 3: Chairman synthesis
    COMPLETE = "complete"
    ERROR = "error"


# =============================================================================
# Agent Configuration
# =============================================================================


class AgentConfig(BaseModel):
    """Configuration for a single LLM agent.

    Allows frontend to dynamically select 1-5 agents from available models.
    """

    name: str = Field(..., description="Display name for the agent (e.g., 'Expert_Alpha')")
    model: str = Field(..., description="Ollama model identifier (e.g., 'qwen2.5:0.5b')")


# =============================================================================
# Request/Response Models
# =============================================================================


class CouncilRequest(BaseModel):
    """User request to start a council deliberation."""

    query: str = Field(..., min_length=1, description="The user's question or prompt")
    selected_agents: list[AgentConfig] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="List of 1-5 agents to participate in the council",
    )
    chairman_model: str = Field(
        default="phi3.5:mini",
        description="Model used for final synthesis by the Chairman",
    )


class GenerateRequest(BaseModel):
    """Request to generate a response from a specific model (Worker API)."""

    model: str = Field(..., description="Ollama model identifier")
    prompt: str = Field(..., description="The prompt to send to the model")
    system: str | None = Field(default=None, description="Optional system prompt")
    format: str | None = Field(
        default=None,
        description="Response format: 'json' for structured output",
    )
    options: dict[str, Any] | None = Field(
        default=None,
        description="Ollama generation options (temperature, etc.)",
    )


class GenerateResponse(BaseModel):
    """Response from the Worker's generate endpoint."""

    model: str = Field(..., description="Model that generated the response")
    content: str = Field(..., description="Generated text content")
    done: bool = Field(default=True, description="Whether generation is complete")
    total_duration: int = Field(default=0, description="Total generation time in nanoseconds")
    eval_count: int = Field(default=0, description="Number of tokens generated")


# =============================================================================
# Agent Response Models
# =============================================================================


class AgentResponse(BaseModel):
    """Response from a single agent during Stage 1."""

    agent_id: str = Field(
        default_factory=lambda: str(uuid4())[:8],
        description="Unique ID (handles duplicate models)",
    )
    agent_name: str = Field(..., description="Display name of the agent")
    model: str = Field(..., description="Model that generated this response")
    content: str = Field(..., description="The agent's response content")
    prompt_tokens: int = Field(default=0, description="Tokens in the input prompt")
    completion_tokens: int = Field(default=0, description="Tokens generated")
    tokens_used: int = Field(default=0, description="Total tokens (prompt + completion)")
    duration_ms: int = Field(default=0, description="Generation time in milliseconds")


class ReviewRanking(BaseModel):
    """Single ranking entry in a review."""

    agent_id: str = Field(..., description="ID of the agent being ranked")
    score: int = Field(..., ge=1, le=10, description="Score from 1-10")
    reasoning: str = Field(..., description="Brief explanation for the score")


class ReviewResult(BaseModel):
    """Result of Stage 2 peer review by one agent."""

    reviewer_id: str = Field(..., description="ID of the reviewing agent")
    reviewer_name: str = Field(..., description="Name of the reviewing agent")
    rankings: list[ReviewRanking] = Field(..., description="Rankings for each other agent")
    prompt_tokens: int = Field(default=0, description="Tokens in the input prompt")
    completion_tokens: int = Field(default=0, description="Tokens generated")


# =============================================================================
# Token Usage Models
# =============================================================================


class TokenUsage(BaseModel):
    """Token usage for a single generation."""

    prompt_tokens: int = Field(default=0, description="Tokens in the input prompt")
    completion_tokens: int = Field(default=0, description="Tokens generated")
    total_tokens: int = Field(default=0, description="Total tokens (prompt + completion)")


class StageTokenUsage(BaseModel):
    """Aggregated token usage for a workflow stage."""

    stage: str = Field(..., description="Stage name: 'opinions', 'review', or 'synthesis'")
    total_prompt_tokens: int = Field(default=0)
    total_completion_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    by_model: dict[str, TokenUsage] = Field(
        default_factory=dict,
        description="Breakdown by model",
    )


class SessionTokenUsage(BaseModel):
    """Complete token usage for an entire council session."""

    stage1_opinions: StageTokenUsage | None = None
    stage2_review: StageTokenUsage | None = None
    stage3_synthesis: StageTokenUsage | None = None

    total_prompt_tokens: int = Field(default=0)
    total_completion_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)


class FinalAnswer(BaseModel):
    """Chairman's synthesized final answer (Stage 3)."""

    content: str = Field(..., description="The final synthesized response")
    chairman_model: str = Field(..., description="Model used for synthesis")
    tokens_used: int = Field(default=0, description="Tokens used for synthesis")
    duration_ms: int = Field(default=0, description="Generation time in milliseconds")
    sources_cited: list[str] = Field(
        default_factory=list,
        description="Agent IDs whose contributions were incorporated",
    )


# =============================================================================
# Session Model
# =============================================================================


class CouncilSession(BaseModel):
    """Complete state of a council deliberation session."""

    session_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique session identifier",
    )
    query: str = Field(..., description="Original user query")
    stage: SessionStage = Field(
        default=SessionStage.PENDING,
        description="Current workflow stage",
    )
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Session creation timestamp",
    )
    updated_at: datetime = Field(
        default_factory=datetime.now,
        description="Last update timestamp",
    )

    # Stage 1: First Opinions
    agents: list[AgentConfig] = Field(
        default_factory=list,
        description="Participating agents configuration",
    )
    opinions: list[AgentResponse] = Field(
        default_factory=list,
        description="Collected agent opinions",
    )

    # Stage 2: Review & Ranking
    reviews: list[ReviewResult] = Field(
        default_factory=list,
        description="Peer review results",
    )

    # Token Usage Statistics
    token_usage: SessionTokenUsage = Field(
        default_factory=SessionTokenUsage,
        description="Complete token usage statistics",
    )

    # Stage 3: Chairman Synthesis
    final_answer: FinalAnswer | None = Field(
        default=None,
        description="Chairman's final synthesized answer",
    )

    # Error handling
    error: str | None = Field(default=None, description="Error message if stage is ERROR")

    def update_stage(self, new_stage: SessionStage) -> None:
        """Update the session stage and timestamp."""
        self.stage = new_stage
        self.updated_at = datetime.now()
