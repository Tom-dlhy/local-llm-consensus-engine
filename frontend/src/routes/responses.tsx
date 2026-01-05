import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { AlertCircle, Eye, Award, MessageSquare } from 'lucide-react'
import { useSession } from '~/context/SessionContext'

export const Route = createFileRoute('/responses')({
  component: ResponsesPage,
})

function ResponsesPage() {
  const { session } = useSession()

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">
            Model Responses & Rankings
          </h2>

          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-amber-700 dark:text-amber-200">No active session. Please submit a question from the Chat page first.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          Model Responses & Rankings
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Session ID: {session.session_id}
        </p>

        {/* Original Question */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 mb-6 border-l-4 border-blue-600">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">
                Original Question
              </h3>
              <p className="text-slate-900 dark:text-slate-50 text-lg">{session.query}</p>
            </div>
          </div>
        </div>

        {/* Opinions - Stage 1 */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Stage 1: First Opinions
          </h3>

          {session.opinions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg p-6 text-center text-slate-600 dark:text-slate-400">
              No opinions available yet
            </div>
          ) : (
            <div className="grid gap-4">
              {session.opinions.map((opinion) => (
                <div
                  key={opinion.agent_id}
                  className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                        {opinion.agent_name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {opinion.model} • {opinion.duration_ms}ms • {opinion.tokens_used} tokens
                      </p>
                    </div>
                    <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-semibold rounded-full">
                      {opinion.agent_id}
                    </div>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {opinion.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews & Rankings - Stage 2 */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            Stage 2: Peer Review & Rankings
          </h3>

          {session.reviews.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg p-6 text-center text-slate-600 dark:text-slate-400">
              No reviews available yet
            </div>
          ) : (
            <div className="grid gap-6">
              {session.reviews.map((review) => (
                <div
                  key={review.reviewer_id}
                  className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700"
                >
                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {review.reviewer_name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Reviewer</p>
                  </div>

                  <div className="space-y-3">
                    {review.rankings.map((ranking, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-50">
                              Agent {ranking.agent_id.replace('agent_', '')}
                            </span>
                            <div className="flex gap-1">
                              {[...Array(10)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full ${
                                    i < ranking.score
                                      ? 'bg-yellow-500'
                                      : 'bg-slate-300 dark:bg-slate-600'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {ranking.reasoning}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                            {ranking.score}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">/10</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-400">
          <p>
            <strong>{session.agents.length}</strong> agents participated • <strong>{session.opinions.length}</strong> opinions collected • <strong>{session.reviews.length}</strong> reviews submitted
          </p>
        </div>
      </div>
    </div>
  )
}
