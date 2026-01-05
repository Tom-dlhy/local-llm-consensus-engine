/**
 * Type definitions for LLM Council
 * Mirror of backend Pydantic models
 */

export enum SessionStage {
  PENDING = 'pending',
  OPINIONS = 'opinions',
  REVIEW = 'review',
  SYNTHESIS = 'synthesis',
  COMPLETE = 'complete',
  ERROR = 'error',
}

// =============================================================================
// Token Usage Types
// =============================================================================

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface StageTokenUsage {
  stage: string // 'opinions' | 'review' | 'synthesis'
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  by_model: Record<string, TokenUsage>
}

export interface SessionTokenUsage {
  stage1_opinions: StageTokenUsage | null
  stage2_review: StageTokenUsage | null
  stage3_synthesis: StageTokenUsage | null
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
}

// =============================================================================
// Agent Configuration
// =============================================================================

export interface AgentConfig {
  name: string
  model: string
}

// =============================================================================
// Response Models
// =============================================================================

export interface AgentResponse {
  agent_id: string
  agent_name: string
  model: string
  content: string
  prompt_tokens: number
  completion_tokens: number
  tokens_used: number
  duration_ms: number
}

export interface ReviewRanking {
  agent_id: string
  score: number // 1-10
  reasoning: string
}

export interface ReviewResult {
  reviewer_id: string
  reviewer_name: string
  rankings: ReviewRanking[]
  prompt_tokens: number
  completion_tokens: number
}

export interface FinalAnswer {
  content: string
  chairman_model: string
  tokens_used: number
  duration_ms: number
  sources_cited: string[]
}

// =============================================================================
// Session Model
// =============================================================================

export interface CouncilSession {
  session_id: string
  query: string
  stage: SessionStage
  created_at: string
  updated_at: string
  agents: AgentConfig[]
  opinions: AgentResponse[]
  reviews: ReviewResult[]
  token_usage: SessionTokenUsage
  final_answer: FinalAnswer | null
  error: string | null
}

// =============================================================================
// Request Models
// =============================================================================

export interface CouncilRequest {
  query: string
  selected_agents: AgentConfig[]
  chairman_model?: string
}

export interface ModelInfo {
  name: string
  display_name: string
  size: string
  description: string
  recommended_role: string
  installed: boolean
}

export interface ModelsResponse {
  recommended: ModelInfo[]
  installed: string[]
}

// =============================================================================
// WebSocket Message Types
// =============================================================================

export interface WSMessage {
  type: 'stage_start' | 'stage_complete' | 'stage_update' | 'error' | 'complete' | 'session_started'
  stage?: SessionStage
  session_id?: string
  session?: CouncilSession
  opinions_count?: number
  reviews_count?: number
  has_final_answer?: boolean
  message?: string
}
