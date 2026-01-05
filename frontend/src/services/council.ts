/**
 * API Service for LLM Council
 * Handles all communication with the backend
 */

import type {
  CouncilRequest,
  CouncilSession,
  ModelsResponse,
  WSMessage,
} from '~/types/council'

const API_BASE_URL =
  (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api'

class CouncilApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ModelsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/council/models`)
      if (!response.ok) throw new Error('Failed to fetch models')
      return await response.json()
    } catch (error) {
      console.error('Error fetching models:', error)
      throw error
    }
  }

  /**
   * Start a council deliberation
   */
  async startCouncil(request: CouncilRequest): Promise<CouncilSession> {
    try {
      const response = await fetch(`${this.baseUrl}/council/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to start council')
      }

      return await response.json()
    } catch (error) {
      console.error('Error starting council:', error)
      throw error
    }
  }

  /**
   * Get a council session by ID
   */
  async getSession(sessionId: string): Promise<CouncilSession> {
    try {
      const response = await fetch(`${this.baseUrl}/council/session/${sessionId}`)
      if (!response.ok) throw new Error('Failed to fetch session')
      return await response.json()
    } catch (error) {
      console.error('Error fetching session:', error)
      throw error
    }
  }

  /**
   * Subscribe to WebSocket for real-time council updates
   */
  subscribeToSession(
    sessionId: string,
    onMessage: (message: WSMessage) => void,
    onError?: (error: string) => void,
    onClose?: () => void
  ): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws')
    const ws = new WebSocket(`${wsUrl}/council/ws/${sessionId}`)

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WSMessage
        onMessage(message)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      onError?.(error.type || 'WebSocket error')
    }

    ws.onclose = () => {
      onClose?.()
    }

    return ws
  }
}

export const councilApiService = new CouncilApiService()
