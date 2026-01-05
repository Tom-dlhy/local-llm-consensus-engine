import asyncio
import logging
from datetime import datetime
from typing import Any

import httpx

from src.config import get_settings
from src.models import (
    AgentConfig,
    AgentResponse,
    CouncilRequest,
    CouncilSession,
    FinalAnswer,
    GenerateRequest,
    ReviewRanking,
    ReviewResult,
    SessionStage,
    StageLatencyStats,
    StageTokenUsage,
    TokenUsage,
)
from src.services.ollama_client import OllamaClient, OllamaError

logger = logging.getLogger(__name__)


# =============================================================================
# Prompt Templates
# =============================================================================

OPINION_SYSTEM_PROMPT = """You are {agent_name}, an expert AI assistant.
Provide a clear, thoughtful, and well-structured response to the user's question.
Be concise but comprehensive. Support your answer with reasoning when appropriate."""

REVIEW_SYSTEM_PROMPT = """You are {agent_name}, tasked with evaluating multiple AI responses.
Analyze each response for accuracy, clarity, completeness, and relevance.
You must respond ONLY with valid JSON in the following format:
{{
    "rankings": [
        {{"agent_id": "<id>", "score": <1-10>, "reasoning": "<brief explanation>"}}
    ]
}}
Score from 1 (worst) to 10 (best). Be fair and objective."""

REVIEW_USER_PROMPT = """Original Question: {query}

Here are the responses from different AI agents. Evaluate each one:

{responses}

Do NOT include a ranking for yourself ({own_agent_id}).
Respond with your JSON rankings only."""

CHAIRMAN_SYSTEM_PROMPT = """You are the Chairman, responsible for synthesizing multiple AI opinions into a final, authoritative answer.
Consider all perspectives and rankings provided. Create a comprehensive response that:
1. Incorporates the best insights from each agent
2. Resolves any contradictions or disagreements
3. Provides a clear, well-structured final answer
4. Cites which agents contributed key insights when relevant"""

CHAIRMAN_USER_PROMPT = """Original Question: {query}

Agent Opinions:
{opinions}

Peer Review Rankings:
{rankings}

Based on all the above, provide the final synthesized answer."""


# =============================================================================
# Council Service
# =============================================================================


class CouncilService:
    """Orchestrates the 3-stage LLM Council workflow."""

    def __init__(self, ollama_client: OllamaClient | None = None):
        """Initialize the council service.

        Args:
            ollama_client: Ollama client for local generation (worker mode)
        """
        self.ollama = ollama_client or OllamaClient()
        self.settings = get_settings()
        self._sessions: dict[str, CouncilSession] = {}

    # =========================================================================
    # Session Management
    # =========================================================================

    def create_session(self, request: CouncilRequest) -> CouncilSession:
        """Create a new council session."""
        # Generate unique agent IDs (handles duplicate models)
        agents_with_ids = []
        for i, agent in enumerate(request.selected_agents):
            agents_with_ids.append(
                AgentConfig(
                    name=agent.name or f"Agent_{i + 1}",
                    model=agent.model,
                )
            )

        session = CouncilSession(
            query=request.query,
            agents=agents_with_ids,
        )
        self._sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> CouncilSession | None:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    # =========================================================================
    # Stage 1: First Opinions
    # =========================================================================

    async def stage1_opinions(
        self,
        session: CouncilSession,
        *,
        worker_url: str | None = None,
    ) -> list[AgentResponse]:
        """Collect first opinions from all agents in parallel.

        Args:
            session: The council session
            worker_url: URL of the worker service (for master mode)

        Returns:
            List of agent responses
        """
        session.update_stage(SessionStage.OPINIONS)
        logger.info(f"Stage 1: Collecting opinions from {len(session.agents)} agents")

        tasks = []
        for i, agent in enumerate(session.agents):
            agent_id = f"agent_{i + 1}"
            task = self._generate_opinion(
                agent_id=agent_id,
                agent=agent,
                query=session.query,
                worker_url=worker_url,
            )
            tasks.append(task)

        # Execute all opinion requests in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)

        opinions = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Agent {i + 1} failed: {result}")
                # Create error response
                opinions.append(
                    AgentResponse(
                        agent_id=f"agent_{i + 1}",
                        agent_name=session.agents[i].name,
                        model=session.agents[i].model,
                        content=f"[Error: {result}]",
                        prompt_tokens=0,
                        completion_tokens=0,
                        tokens_used=0,
                        duration_ms=0,
                    )
                )
            else:
                opinions.append(result)

        session.opinions = opinions

        # Calculate token usage for Stage 1
        session.token_usage.stage1_opinions = self._calculate_stage_usage(
            stage="opinions",
            items=opinions,
        )
        self._update_total_usage(session)

        # Calculate latency stats for Stage 1
        session.latency_stats.stage1_opinions = self._calculate_stage_latency(
            stage="opinions",
            items=opinions,
        )
        self._update_total_latency(session)

        session.updated_at = datetime.now()
        return opinions

    async def _generate_opinion(
        self,
        agent_id: str,
        agent: AgentConfig,
        query: str,
        worker_url: str | None = None,
    ) -> AgentResponse:
        """Generate a single agent's opinion.

        Args:
            agent_id: Unique agent identifier
            agent: Agent configuration
            query: User query
            worker_url: Worker URL (if in master mode)
        """
        system_prompt = OPINION_SYSTEM_PROMPT.format(agent_name=agent.name)

        start_time = datetime.now()

        if worker_url:
            # Master mode: call worker API
            response = await self._call_worker(
                worker_url=worker_url,
                model=agent.model,
                prompt=query,
                system=system_prompt,
            )
            raw_content = response.get("content", "")
            prompt_tokens = response.get("prompt_eval_count", 0)
            completion_tokens = response.get("eval_count", 0)
        else:
            # Worker mode: call Ollama directly
            response = await self.ollama.generate(
                model=agent.model,
                prompt=query,
                system=system_prompt,
            )
            raw_content = response.get("response", "")
            prompt_tokens = response.get("prompt_eval_count", 0)
            completion_tokens = response.get("eval_count", 0)

        logger.info(f"[Stage 1] Agent {agent_id} ({agent.model}) raw response length: {len(raw_content)}")
        if len(raw_content) < 500:
             logger.debug(f"[Stage 1] Agent {agent_id} raw response: {raw_content}")

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return AgentResponse(
            agent_id=agent_id,
            agent_name=agent.name,
            model=agent.model,
            content=raw_content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            tokens_used=prompt_tokens + completion_tokens,
            duration_ms=duration_ms,
        )

    # =========================================================================
    # Stage 2: Review & Ranking
    # =========================================================================

    async def stage2_review(
        self,
        session: CouncilSession,
        *,
        worker_url: str | None = None,
    ) -> list[ReviewResult]:
        """Perform peer review of all opinions.

        Each agent reviews and ranks the responses of all other agents.
        Uses JSON mode for structured output.

        Args:
            session: The council session
            worker_url: URL of the worker service (for master mode)

        Returns:
            List of review results
        """
        session.update_stage(SessionStage.REVIEW)
        logger.info(f"Stage 2: Peer review by {len(session.agents)} agents")

        # Format all opinions for review (anonymized)
        responses_text = self._format_opinions_for_review(session.opinions)

        tasks = []
        for i, agent in enumerate(session.agents):
            # Each agent reviews others (excluding self)
            task = self._generate_review(
                reviewer_id=f"agent_{i + 1}",
                reviewer_name=agent.name,
                model=agent.model,
                query=session.query,
                responses_text=responses_text,
                own_agent_id=f"agent_{i + 1}",
                worker_url=worker_url,
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        reviews = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Review by agent {i + 1} failed: {result}")
            else:
                reviews.append(result)

        session.reviews = reviews

        # Calculate token usage for Stage 2
        session.token_usage.stage2_review = self._calculate_stage_usage(
            stage="review",
            items=reviews,
        )
        self._update_total_usage(session)

        # Calculate latency stats for Stage 2
        session.latency_stats.stage2_review = self._calculate_stage_latency(
            stage="review",
            items=reviews,
        )
        self._update_total_latency(session)

        session.updated_at = datetime.now()
        return reviews

    def _format_opinions_for_review(self, opinions: list[AgentResponse]) -> str:
        """Format opinions for the review prompt."""
        parts = []
        for op in opinions:
            parts.append(f"[{op.agent_id}]:\n{op.content}\n")
        return "\n---\n".join(parts)

    async def _generate_review(
        self,
        reviewer_id: str,
        reviewer_name: str,
        model: str,
        query: str,
        responses_text: str,
        own_agent_id: str,
        worker_url: str | None = None,
    ) -> ReviewResult:
        """Generate a single agent's review."""
        system_prompt = REVIEW_SYSTEM_PROMPT.format(agent_name=reviewer_name)
        user_prompt = REVIEW_USER_PROMPT.format(
            query=query,
            responses=responses_text,
            own_agent_id=own_agent_id,
        )

        start_time = datetime.now()

        if worker_url:
            response = await self._call_worker(
                worker_url=worker_url,
                model=model,
                prompt=user_prompt,
                system=system_prompt,
                format="json",
            )
            raw_content = response.get("content", "{}")
            prompt_tokens = response.get("prompt_eval_count", 0)
            completion_tokens = response.get("eval_count", 0)
        else:
            response = await self.ollama.generate(
                model=model,
                prompt=user_prompt,
                system=system_prompt,
                format="json",
            )
            raw_content = response.get("response", "{}")
            prompt_tokens = response.get("prompt_eval_count", 0)
            completion_tokens = response.get("eval_count", 0)

        # Parse JSON response
        rankings = self._parse_review_response(raw_content, own_agent_id)

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return ReviewResult(
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name,
            model=model,
            rankings=rankings,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            duration_ms=duration_ms,
        )

    def _parse_review_response(
        self, response_text: str, own_agent_id: str
    ) -> list[ReviewRanking]:
        """Parse the JSON review response."""
        import json

        try:
            data = json.loads(response_text)
            rankings = []

            for item in data.get("rankings", []):
                # Skip self-review (normalize for safety)
                ranked_id = str(item.get("agent_id", "")).strip().lower()
                clean_own_id = str(own_agent_id).strip().lower()
                if ranked_id == clean_own_id or ranked_id in clean_own_id:
                     continue

                rankings.append(
                    ReviewRanking(
                        agent_id=item.get("agent_id", "unknown"),
                        score=max(1, min(10, int(item.get("score", 5)))),
                        reasoning=item.get("reasoning", "No reasoning provided"),
                    )
                )

            return rankings

        except (json.JSONDecodeError, KeyError, TypeError) as e:
            logger.warning(f"Failed to parse review JSON: {e}")
            return []

    # =========================================================================
    # Stage 3: Chairman Synthesis
    # =========================================================================

    async def stage3_synthesis(
        self,
        session: CouncilSession,
        *,
        chairman_model: str | None = None,
    ) -> FinalAnswer:
        """Generate the Chairman's final synthesized answer.

        Args:
            session: The council session
            chairman_model: Override model for Chairman

        Returns:
            The final answer
        """
        session.update_stage(SessionStage.SYNTHESIS)
        logger.info("Stage 3: Chairman synthesis")

        model = chairman_model or self.settings.chairman_model

        # Format inputs for Chairman
        opinions_text = self._format_opinions_for_chairman(session.opinions)
        rankings_text = self._format_rankings_for_chairman(session.reviews)

        user_prompt = CHAIRMAN_USER_PROMPT.format(
            query=session.query,
            opinions=opinions_text,
            rankings=rankings_text,
        )

        start_time = datetime.now()

        response = await self.ollama.generate(
            model=model,
            prompt=user_prompt,
            system=CHAIRMAN_SYSTEM_PROMPT,
        )

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        prompt_tokens = response.get("prompt_eval_count", 0)
        completion_tokens = response.get("eval_count", 0)

        # Identify top-ranked agents
        top_agents = self._get_top_ranked_agents(session.reviews)

        final_answer = FinalAnswer(
            content=response.get("response", ""),
            chairman_model=model,
            tokens_used=prompt_tokens + completion_tokens,
            duration_ms=duration_ms,
            sources_cited=top_agents,
        )

        session.final_answer = final_answer

        # Calculate token usage for Stage 3
        session.token_usage.stage3_synthesis = StageTokenUsage(
            stage="synthesis",
            total_prompt_tokens=prompt_tokens,
            total_completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            by_model={
                model: TokenUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens,
                )
            },
        )
        self._update_total_usage(session)

        # Calculate latency stats for Stage 3
        session.latency_stats.stage3_synthesis = StageLatencyStats(
            stage="synthesis",
            total_duration_ms=duration_ms,
            by_model={model: duration_ms},
        )
        self._update_total_latency(session)

        session.update_stage(SessionStage.COMPLETE)
        return final_answer

    def _format_opinions_for_chairman(self, opinions: list[AgentResponse]) -> str:
        """Format opinions for Chairman prompt."""
        parts = []
        for op in opinions:
            parts.append(f"[{op.agent_name} ({op.agent_id})]:\n{op.content}")
        return "\n\n---\n\n".join(parts)

    def _format_rankings_for_chairman(self, reviews: list[ReviewResult]) -> str:
        """Format rankings for Chairman prompt."""
        # Aggregate scores by agent
        scores: dict[str, list[int]] = {}
        for review in reviews:
            for ranking in review.rankings:
                if ranking.agent_id not in scores:
                    scores[ranking.agent_id] = []
                scores[ranking.agent_id].append(ranking.score)

        # Calculate averages
        parts = []
        for agent_id, score_list in sorted(scores.items()):
            avg = sum(score_list) / len(score_list) if score_list else 0
            parts.append(f"{agent_id}: Average score {avg:.1f}/10")

        return "\n".join(parts)

    def _get_top_ranked_agents(self, reviews: list[ReviewResult], top_n: int = 3) -> list[str]:
        """Get the top-ranked agent IDs."""
        scores: dict[str, list[int]] = {}
        for review in reviews:
            for ranking in review.rankings:
                if ranking.agent_id not in scores:
                    scores[ranking.agent_id] = []
                scores[ranking.agent_id].append(ranking.score)

        # Calculate averages and sort
        averages = [
            (agent_id, sum(s) / len(s)) for agent_id, s in scores.items() if s
        ]
        averages.sort(key=lambda x: x[1], reverse=True)

        return [agent_id for agent_id, _ in averages[:top_n]]

    # =========================================================================
    # Token Usage Helpers
    # =========================================================================

    def _calculate_stage_usage(
        self,
        stage: str,
        items: list[AgentResponse] | list[ReviewResult],
    ) -> StageTokenUsage:
        """Calculate aggregated token usage for a stage.

        Args:
            stage: Stage name ('opinions' or 'review')
            items: List of AgentResponse or ReviewResult objects

        Returns:
            StageTokenUsage with totals and per-model breakdown
        """
        by_model: dict[str, TokenUsage] = {}
        total_prompt = 0
        total_completion = 0

        for item in items:
            model = getattr(item, "model", "unknown")

            prompt = getattr(item, "prompt_tokens", 0)
            completion = getattr(item, "completion_tokens", 0)

            total_prompt += prompt
            total_completion += completion

            if model not in by_model:
                by_model[model] = TokenUsage(
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                )

            by_model[model].prompt_tokens += prompt
            by_model[model].completion_tokens += completion
            by_model[model].total_tokens += prompt + completion

        return StageTokenUsage(
            stage=stage,
            total_prompt_tokens=total_prompt,
            total_completion_tokens=total_completion,
            total_tokens=total_prompt + total_completion,
            by_model=by_model,
        )

    def _update_total_usage(self, session: CouncilSession) -> None:
        """Update the total token usage in the session.

        Sums up all stage usages into the session total.
        """
        total_prompt = 0
        total_completion = 0

        if session.token_usage.stage1_opinions:
            total_prompt += session.token_usage.stage1_opinions.total_prompt_tokens
            total_completion += session.token_usage.stage1_opinions.total_completion_tokens

        if session.token_usage.stage2_review:
            total_prompt += session.token_usage.stage2_review.total_prompt_tokens
            total_completion += session.token_usage.stage2_review.total_completion_tokens

        if session.token_usage.stage3_synthesis:
            total_prompt += session.token_usage.stage3_synthesis.total_prompt_tokens
            total_completion += session.token_usage.stage3_synthesis.total_completion_tokens

        session.token_usage.total_prompt_tokens = total_prompt
        session.token_usage.total_completion_tokens = total_completion
        session.token_usage.total_tokens = total_prompt + total_completion

    def _calculate_stage_latency(
        self,
        stage: str,
        items: list[AgentResponse] | list[ReviewResult],
    ) -> StageLatencyStats:
        """Calculate aggregated latency stats for a stage."""
        by_model: dict[str, int] = {}
        total_duration = 0

        for item in items:
            model = getattr(item, "model", "unknown")
            duration = getattr(item, "duration_ms", 0)

            total_duration += duration
            # For parallel stages (Opnions, Review), we might want MAX duration for "stage duration",
            # but for "Latency per model" we sum up per model.
            # The user asked for "Latency per model", so we sum per model.
            # But the "Total" for the stage usually means wall-clock time for the stage.
            # However, here we are aggregating metrics.
            # If multiple agents run in parallel, the stage duration is max(agent_durations).
            # But here `total_duration_ms` in `StageLatencyStats` likely refers to sum of computing time?
            # Or the user wants to see the total wait time?
            # "J'ai besoin de connaitre le temps de l'attence de chaque modèle" -> Latency per model.
            # Let's sum per model.

            by_model[model] = (by_model.get(model, 0) + duration)

        # For the stage total, if we want to show "Latency per model",
        # the total might be less relevant than the max if it's parallel.
        # But let's stick to summing for now as a "total compute time" metric,
        # or maybe we should calculate the max for the stage duration?
        # The user visualizes it as a Bar Plot per model.
        # Let's just track the sum of all durations for now as "total_duration_ms"
        # but keep in mind that for parallel execution, wall clock is different.
        # Given the "Summary" tab request "juste le temps de l'attence end-to-end",
        # that will be tracked at the session level separately or summed here.
        # Let's just sum it here for consistency with token usage.

        return StageLatencyStats(
            stage=stage,
            total_duration_ms=total_duration,
            by_model=by_model,
        )

    def _update_total_latency(self, session: CouncilSession) -> None:
        """Update total session duration."""
        # For the total session duration, we should strictly compare start/end times of the session,
        # but since we are building it incrementally, and we want "End-to-End",
        # we can approximate it by summing stage MAX durations or just taking (now - created_at).
        # Actually, taking (now - created_at) is the most accurate definition of "End-to-End latency".
        if session.created_at:
             session.latency_stats.total_duration_ms = int(
                 (datetime.now() - session.created_at).total_seconds() * 1000
             )

    # =========================================================================
    # Full Workflow
    # =========================================================================

    async def run_council(
        self,
        request: CouncilRequest,
        *,
        worker_url: str | None = None,
    ) -> CouncilSession:
        """Run the complete 3-stage council workflow.

        Args:
            request: Council request with query and agents
            worker_url: Worker URL for master mode

        Returns:
            Completed council session
        """
        session = self.create_session(request)

        try:
            # Stage 1: Opinions
            await self.stage1_opinions(session, worker_url=worker_url)

            # Stage 2: Review
            await self.stage2_review(session, worker_url=worker_url)

            # Stage 3: Synthesis
            await self.stage3_synthesis(
                session,
                chairman_model=request.chairman_model,
            )

        except Exception as e:
            logger.error(f"Council workflow failed: {e}")
            session.error = str(e)
            session.update_stage(SessionStage.ERROR)

        return session

    # =========================================================================
    # Worker Communication
    # =========================================================================

    async def _call_worker(
        self,
        worker_url: str,
        model: str,
        prompt: str,
        system: str | None = None,
        format: str | None = None,
    ) -> dict[str, Any]:
        """Call the worker service to generate a response.

        Args:
            worker_url: Worker service URL
            model: Model to use
            prompt: Generation prompt
            system: System prompt
            format: Response format

        Returns:
            Generation response dict
        """
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(self.settings.generation_timeout, connect=10.0)
        ) as client:
            payload = GenerateRequest(
                model=model,
                prompt=prompt,
                system=system,
                format=format,
            )

            try:
                response = await client.post(
                    f"{worker_url.rstrip('/')}/api/generate",
                    json=payload.model_dump(exclude_none=True),
                )
                response.raise_for_status()
                return response.json()

            except httpx.TimeoutException as e:
                raise OllamaError(f"Worker timeout: {e}") from e
            except httpx.HTTPStatusError as e:
                raise OllamaError(
                    f"Worker error: {e.response.text}",
                    e.response.status_code,
                ) from e
