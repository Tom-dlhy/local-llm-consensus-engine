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

export interface AgentConfig {
  name: string
  model: string
}

export interface AgentResponse {
  agent_id: string
  agent_name: string
  model: string
  content: string
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
}

export interface FinalAnswer {
  content: string
  chairman_model: string
  tokens_used: number
  duration_ms: number
  sources_cited: string[]
}

export interface CouncilSession {
  session_id: string
  query: string
  stage: SessionStage
  created_at: string
  updated_at: string
  agents: AgentConfig[]
  opinions: AgentResponse[]
  reviews: ReviewResult[]
  final_answer: FinalAnswer | null
  error: string | null
}

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

// WebSocket message types
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
