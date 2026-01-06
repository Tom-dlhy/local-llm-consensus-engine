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
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">Key Performance Indicators</h2>
        </div>

        {/* Session Token Usage */}
        {session?.token_usage ? (
          <TokenUsageStats
            tokenUsage={session.token_usage}
            latencyStats={session.latency_stats}
            reviews={session.reviews}
          />
        ) : (
          <EmptyState
            title="No Token Data"
            message="Run a council session to see token usage statistics."
          />
        )}

      </div>
    </div>
  )
}
