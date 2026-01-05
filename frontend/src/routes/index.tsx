import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { councilApiService } from '~/services/council'
import { useSession } from '~/context/SessionContext'
import {
  ModelSelector,
  QueryForm,
  StageProgress,
  FinalAnswerCard,
} from '~/components/council'
import type { ModelInfo, SessionStage, WSMessage } from '~/types/council'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

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
  const [stageCounts, setStageCounts] = React.useState({ opinions: 0, reviews: 0 })
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

  // Cleanup WebSocket on unmount
  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
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

  const handleSubmit = async () => {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Query Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Ask the Council</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ModelSelector
              models={availableModels}
              selectedModels={selectedModels}
              onToggle={handleModelToggle}
              disabled={status === 'loading'}
            />

            <QueryForm
              query={query}
              onQueryChange={setQuery}
              onSubmit={handleSubmit}
              isLoading={status === 'loading'}
              disabled={selectedModels.size === 0}
              error={error}
            />
          </CardContent>
        </Card>

        {/* Progress and Results */}
        {session && (
          <>
            <StageProgress
              stage={currentStage}
              status={status}
              agentCount={session.agents.length}
              opinionsCount={stageCounts.opinions}
              reviewsCount={stageCounts.reviews}
            />

            {session.final_answer && (
              <FinalAnswerCard answer={session.final_answer} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
