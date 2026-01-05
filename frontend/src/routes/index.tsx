import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Send, Loader2, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { councilApiService } from '~/services/council'
import { useSession } from '~/context/SessionContext'
import type {
  ModelInfo,
  SessionStage,
  WSMessage,
} from '~/types/council'

export const Route = createFileRoute('/')({
  component: ChatPage,
})

type Status = 'idle' | 'loading' | 'complete' | 'error'

function ChatPage() {
  const { session, setSession } = useSession()
  const [query, setQuery] = React.useState('')
  const [availableModels, setAvailableModels] = React.useState<ModelInfo[]>([])
  const [selectedModels, setSelectedModels] = React.useState<Set<string>>(new Set())
  const [status, setStatus] = React.useState<Status>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [currentStage, setCurrentStage] = React.useState<SessionStage | null>(null)
  const [stageCounts, setStageCounts] = React.useState({
    opinions: 0,
    reviews: 0,
  })
  const wsRef = React.useRef<WebSocket | null>(null)

  // Load available models on mount
  React.useEffect(() => {
    const loadModels = async () => {
      try {
        const data = await councilApiService.getModels()
        setAvailableModels(data.recommended.filter((m) => m.installed))
      } catch (err) {
        console.error('Failed to load models:', err)
        setError('Failed to load available models')
      }
    }
    loadModels()
  }, [])

  const handleModelToggle = (modelName: string) => {
    const newSelected = new Set(selectedModels)
    if (newSelected.has(modelName)) {
      newSelected.delete(modelName)
    } else {
      newSelected.add(modelName)
    }
    setSelectedModels(newSelected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) {
      setError('Please enter a question')
      return
    }

    if (selectedModels.size === 0) {
      setError('Please select at least one model')
      return
    }

    setStatus('loading')
    setError(null)
    setSession(null)
    setStageCounts({ opinions: 0, reviews: 0 })

    try {
      // Start council
      const newSession = await councilApiService.startCouncil({
        query: query.trim(),
        selected_agents: Array.from(selectedModels).map((model) => ({
          name: model.split(':')[0],
          model: model,
        })),
      })

      setSession(newSession)
      setCurrentStage(newSession.stage as SessionStage)

      // Subscribe to WebSocket updates
      wsRef.current = councilApiService.subscribeToSession(
        newSession.session_id,
        (message: WSMessage) => {
          console.log('WS Message:', message)

          if (message.type === 'complete' && message.session) {
            setSession(message.session)
            setCurrentStage(message.session.stage as SessionStage)
            setStatus('complete')
          } else if (message.type === 'stage_update') {
            if (message.stage) {
              setCurrentStage(message.stage)
            }
            setStageCounts({
              opinions: message.opinions_count || 0,
              reviews: message.reviews_count || 0,
            })
          } else if (message.type === 'error') {
            setError(message.message || 'An error occurred')
            setStatus('error')
          }
        },
        (errorMsg) => {
          setError(errorMsg)
          setStatus('error')
        }
      )
    } catch (err) {
      console.error('Error starting council:', err)
      setError(err instanceof Error ? err.message : 'Failed to start council')
      setStatus('error')
    }
  }

  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const stageLabels: Record<SessionStage, string> = {
    pending: 'Pending',
    opinions: 'Stage 1: Collecting Opinions',
    review: 'Stage 2: Peer Review',
    synthesis: 'Stage 3: Chairman Synthesis',
    complete: 'Complete',
    error: 'Error',
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">
            Ask the Council
          </h2>

          {/* Model Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Select Models ({selectedModels.size} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableModels.map((model) => (
                <div
                  key={model.name}
                  className="flex items-start gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => handleModelToggle(model.name)}
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.has(model.name)}
                    onChange={() => handleModelToggle(model.name)}
                    className="w-4 h-4 text-blue-600 rounded mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-50">
                      {model.display_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {model.size}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Query Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Your Question
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask the council a question..."
                disabled={status === 'loading'}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 placeholder-slate-500 dark:placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || selectedModels.size === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Council in Progress...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit to Council
                </>
              )}
            </button>
          </form>
        </div>

        {/* Progress and Results */}
        {session && (
          <div className="space-y-4">
            {/* Stage Progress */}
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Current Stage
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {currentStage ? stageLabels[currentStage] : 'Unknown'}
                  </span>
                  {status === 'loading' && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  )}
                  {status === 'complete' && (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  )}
                </div>

                {currentStage === 'opinions' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Collecting opinions from {stageCounts.opinions} / {session.agents.length} agents
                  </p>
                )}
                {currentStage === 'review' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Peer review in progress ({stageCounts.reviews} agents reviewed)
                  </p>
                )}
                {currentStage === 'synthesis' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chairman synthesizing final answer...
                  </p>
                )}
              </div>
            </div>

            {/* Final Answer */}
            {session.final_answer && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                    Chairman's Final Answer
                  </h3>
                </div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {session.final_answer.content}
                </p>
                <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    Model: {session.final_answer.chairman_model}
                  </span>
                  <span>
                    {session.final_answer.duration_ms}ms
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
