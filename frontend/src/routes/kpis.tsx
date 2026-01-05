import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { BarChart3, TrendingUp, Lightbulb } from 'lucide-react'
import { useSession } from '~/context/SessionContext'
import { TokenUsageStats, EmptyState, TokenDistributionChart } from '~/components/council'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export const Route = createFileRoute('/kpis')({
  component: KPIsPage,
})

function KPIsPage() {
  const { session } = useSession()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">Key Performance Indicators</h2>
          <p className="text-muted-foreground">
            Monitor council performance and system metrics
          </p>
        </div>

        {/* Session Token Usage */}
        {/* Session Token Usage */}
        {session?.token_usage ? (
          <TokenUsageStats tokenUsage={session.token_usage} />
        ) : (
          <EmptyState
            title="No Token Data"
            message="Run a council session to see token usage statistics."
          />
        )}

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </CardTitle>
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{session ? 1 : 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {session ? 'Active session' : 'No active sessions'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Agents Used
                </CardTitle>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{session?.agents.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {session ? `In session ${session.session_id.slice(0, 8)}...` : 'No agents'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Tokens
                </CardTitle>
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {session?.token_usage?.total_tokens?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Across all stages</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Reviews Collected
                </CardTitle>
                <TrendingUp className="w-5 h-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{session?.reviews.length || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Peer rankings</p>
            </CardContent>
          </Card>
        </div>

        {/* Tip */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm">
                <strong>Tip:</strong> Run council sessions from the Chat page to populate these metrics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
