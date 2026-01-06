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
1. RESPOND IN THE SAME LANGUAGE AS THE USER'S QUESTION.
2. Be extremely concise and direct. Avoid filler words, introductions, or excessive verbosity.
3. Provide the answer immediately without fluff."""

REVIEW_SYSTEM_PROMPT = """You are {agent_name}, evaluating a single AI response.
1. RESPOND IN THE SAME LANGUAGE AS THE QUESTION.
2. Rate the response from 1 (poor) to 10 (excellent) based on accuracy, clarity, and relevance.
3. Respond ONLY with JSON: {{"score": <1-10>, "reasoning": "<brief explanation>"}}"""

REVIEW_USER_PROMPT = """Question: {query}

Response to evaluate:
{response}

Provide your JSON score only."""

CHAIRMAN_SYSTEM_PROMPT = """You are the Chairman.
1. RESPOND IN THE SAME LANGUAGE AS THE USER'S QUESTION.
2. Synthesize the provided opinions into one single, clear, and direct final answer.
3. Do NOT explain the process or list what each agent said individually.
4. Go straight to the point and give the best possible response."""

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
    # Stage 2: Review & Ranking (Pairwise)
    # =========================================================================

    async def stage2_review(
        self,
        session: CouncilSession,
        *,
        worker_url: str | None = None,
    ) -> list[ReviewResult]:
        """Perform peer review using pairwise evaluations.

        Each agent evaluates each other agent's response individually.
        For n agents, this creates n*(n-1) parallel LLM calls.

        Args:
            session: The council session
            worker_url: URL of the worker service (for master mode)

        Returns:
            List of review results (one per reviewer)
        """
        session.update_stage(SessionStage.REVIEW)
        n = len(session.agents)
        total_evals = n * (n - 1)
        logger.info(f"Stage 2: Pairwise review - {total_evals} evaluations for {n} agents")

        # Build all pairwise evaluation tasks
        pairwise_tasks: list[tuple[str, str, str, asyncio.Task]] = []
        
        for i, reviewer in enumerate(session.agents):
            reviewer_id = f"agent_{i + 1}"
            
            for j, target in enumerate(session.agents):
                if i == j:
                    continue  # Skip self-evaluation
                
                target_id = f"agent_{j + 1}"
                target_opinion = session.opinions[j]
                
                task = self._generate_pairwise_review(
                    reviewer_id=reviewer_id,
                    reviewer_name=reviewer.name,
                    model=reviewer.model,
                    query=session.query,
                    target_id=target_id,
                    target_response=target_opinion.content,
                    worker_url=worker_url,
                )
                pairwise_tasks.append((reviewer_id, reviewer.name, reviewer.model, task))

        # Execute ALL pairwise evaluations in parallel
        tasks_only = [t[3] for t in pairwise_tasks]
        results = await asyncio.gather(*tasks_only, return_exceptions=True)

        # Aggregate results by reviewer
        reviews = self._aggregate_pairwise_results(pairwise_tasks, results)
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

    async def _generate_pairwise_review(
        self,
        reviewer_id: str,
        reviewer_name: str,
        model: str,
        query: str,
        target_id: str,
        target_response: str,
        worker_url: str | None = None,
    ) -> dict[str, Any]:
        """Generate a single pairwise evaluation.

        Args:
            reviewer_id: ID of the reviewing agent
            reviewer_name: Name of the reviewing agent
            model: Model to use for review
            query: Original user query
            target_id: ID of the agent being evaluated
            target_response: The response content to evaluate
            worker_url: Worker URL (if in master mode)

        Returns:
            Dict with target_id, score, reasoning, tokens, and duration
        """
        system_prompt = REVIEW_SYSTEM_PROMPT.format(agent_name=reviewer_name)
        user_prompt = REVIEW_USER_PROMPT.format(
            query=query,
            response=target_response,
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

        # Parse atomic JSON response
        score, reasoning = self._parse_pairwise_response(raw_content)
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return {
            "reviewer_id": reviewer_id,
            "target_id": target_id,
            "score": score,
            "reasoning": reasoning,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "duration_ms": duration_ms,
            "model": model,
        }

    def _parse_pairwise_response(self, response_text: str) -> tuple[int, str]:
        """Parse atomic JSON: {"score": X, "reasoning": "..."}.

        Args:
            response_text: Raw JSON string from LLM

        Returns:
            Tuple of (score, reasoning)
        """
        import json

        try:
            data = json.loads(response_text)
            score = max(1, min(10, int(data.get("score", 5))))
            reasoning = str(data.get("reasoning", "No reasoning provided"))
            return score, reasoning
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.warning(f"Failed to parse pairwise review JSON: {e}")
            return 5, "Parse error - defaulting to neutral score"

    def _aggregate_pairwise_results(
        self,
        task_metadata: list[tuple[str, str, str, Any]],
        results: list[Any],
    ) -> list[ReviewResult]:
        """Aggregate pairwise evaluation results by reviewer.

        Groups all individual evaluations by reviewer_id and creates
        ReviewResult objects compatible with the existing data model.

        Args:
            task_metadata: List of (reviewer_id, reviewer_name, model, task) tuples
            results: Results from asyncio.gather (may include exceptions)

        Returns:
            List of ReviewResult objects, one per reviewer
        """
        # Group results by reviewer
        grouped: dict[str, dict[str, Any]] = {}

        for (reviewer_id, reviewer_name, model, _), result in zip(task_metadata, results):
            if isinstance(result, Exception):
                logger.warning(f"Pairwise review by {reviewer_id} failed: {result}")
                continue

            if reviewer_id not in grouped:
                grouped[reviewer_id] = {
                    "reviewer_name": reviewer_name,
                    "model": model,
                    "rankings": [],
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "duration_ms": 0,
                }

            grouped[reviewer_id]["rankings"].append(
                ReviewRanking(
                    agent_id=result["target_id"],
                    score=result["score"],
                    reasoning=result["reasoning"],
                )
            )
            grouped[reviewer_id]["prompt_tokens"] += result["prompt_tokens"]
            grouped[reviewer_id]["completion_tokens"] += result["completion_tokens"]
            grouped[reviewer_id]["duration_ms"] += result["duration_ms"]

        # Convert to ReviewResult list
        return [
            ReviewResult(
                reviewer_id=rid,
                reviewer_name=data["reviewer_name"],
                model=data["model"],
                rankings=data["rankings"],
                prompt_tokens=data["prompt_tokens"],
                completion_tokens=data["completion_tokens"],
                duration_ms=data["duration_ms"],
            )
            for rid, data in grouped.items()
        ]

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
