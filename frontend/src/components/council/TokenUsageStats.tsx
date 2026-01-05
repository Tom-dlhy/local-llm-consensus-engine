/**
 * TokenUsageStats Component
 * Displays token usage metrics per stage and totals
 */

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { BarChart3 } from 'lucide-react'
import type { SessionTokenUsage, StageTokenUsage, SessionLatencyStats, StageLatencyStats } from '~/types/council'
import { TokenDistributionChart } from './TokenDistributionChart'
import { LatencyBarChart } from './LatencyBarChart'

interface TokenUsageStatsProps {
    tokenUsage: SessionTokenUsage
    latencyStats?: SessionLatencyStats
}

// Helper to extract distribution from a single stage
function getStageDistribution(stage: StageTokenUsage | null): Record<string, number> {
    if (!stage?.by_model) return {}
    const dist: Record<string, number> = {}
    Object.entries(stage.by_model).forEach(([model, usage]) => {
        dist[model] = usage.total_tokens
    })
    return dist
}

// Helper to extract total distribution from full session
function getSessionDistribution(session: SessionTokenUsage): Record<string, number> {
    const dist: Record<string, number> = {}

    const addStage = (stage: StageTokenUsage | null) => {
        if (!stage?.by_model) return
        Object.entries(stage.by_model).forEach(([model, usage]) => {
            dist[model] = (dist[model] || 0) + usage.total_tokens
        })
    }

    addStage(session.stage1_opinions)
    addStage(session.stage2_review)
    addStage(session.stage3_synthesis)

    return dist
}

// Helper for latency distribution
function getStageLatency(stage: StageLatencyStats | null): Record<string, number> {
    return stage?.by_model || {}
}

// Helper to format duration
function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(3, '0')}`;
}

interface StatsDisplayProps {
    prompt: number
    completion: number
    total: number
    durationMs?: number
}

function StatsDisplay({ prompt, completion, total, durationMs }: StatsDisplayProps) {
    return (
        <div className="flex flex-col space-y-8 w-full">
            {/* Top row: 3 pillars */}
            <div className="grid grid-cols-3 gap-4 text-center divide-x divide-border">
                <div className="px-2">
                    <p className="text-3xl font-bold font-serif">{prompt.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Total Prompt</p>
                </div>
                <div className="px-2">
                    <p className="text-3xl font-bold font-serif">{completion.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Total Completion</p>
                </div>
                <div className="px-2">
                    <p className="text-3xl font-bold font-serif text-primary text-4xl">{total.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold text-primary">Grand Total</p>
                </div>
            </div>

            {/* Bottom row: Centered Duration */}
            {durationMs !== undefined && (
                <div className="flex flex-col items-center justify-center pt-4 border-t border-border/50">
                    <p className="text-4xl font-bold font-serif tracking-tight text-slate-800 dark:text-slate-200">
                        {formatDuration(durationMs)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 uppercase tracking-[0.2em] font-medium">
                        Total Execution Latency
                    </p>
                </div>
            )}
        </div>
    )
}

function TabContentLayout({
    distribution,
    latencyDistribution,
    stats,
    isSummary
}: {
    distribution: Record<string, number>,
    latencyDistribution?: Record<string, number>,
    stats: StatsDisplayProps,
    isSummary?: boolean
}) {
    // If summary, we use 2 columns grid (Stats | Pie)
    if (isSummary) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center py-6">
                <div className="stats-column flex flex-col justify-center space-y-6">
                    <StatsDisplay {...stats} />
                    {/* Include total duration text if available in stats props or handled by container */}
                </div>
                <div className="chart-column border-l border-border pl-8 min-h-[300px]">
                    <TokenDistributionChart
                        distribution={distribution}
                        title="Token Distribution"
                        footerText="Usage by model for this scope"
                    />
                </div>
            </div>
        )
    }

    // If specific stage, we use 3 columns (Stats | Pie | Bar)
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center py-6">
            <div className="stats-column flex flex-col justify-center space-y-6 col-span-1">
                <StatsDisplay {...stats} />
            </div>

            <div className="chart-column border-l border-border pl-8 min-h-[300px] col-span-1">
                <TokenDistributionChart
                    distribution={distribution}
                    title="Token Distribution"
                    footerText="Usage by model"
                />
            </div>

            <div className="chart-column border-l border-border pl-8 min-h-[300px] col-span-1">
                {latencyDistribution ? (
                    <LatencyBarChart distribution={latencyDistribution} />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No latency data
                    </div>
                )}
            </div>
        </div>
    )
}

export function TokenUsageStats({ tokenUsage, latencyStats }: TokenUsageStatsProps) {
    // Pre-calculate distributions
    const summaryDistribution = React.useMemo(() => getSessionDistribution(tokenUsage), [tokenUsage])
    const stage1Distribution = React.useMemo(() => getStageDistribution(tokenUsage.stage1_opinions), [tokenUsage])
    const stage2Distribution = React.useMemo(() => getStageDistribution(tokenUsage.stage2_review), [tokenUsage])
    const stage3Distribution = React.useMemo(() => getStageDistribution(tokenUsage.stage3_synthesis), [tokenUsage])

    // Pre-calculate Latency
    const stage1Latency = React.useMemo(() => getStageLatency(latencyStats?.stage1_opinions || null), [latencyStats])
    const stage2Latency = React.useMemo(() => getStageLatency(latencyStats?.stage2_review || null), [latencyStats])
    const stage3Latency = React.useMemo(() => getStageLatency(latencyStats?.stage3_synthesis || null), [latencyStats])

    return (
        <Card className="shadow-md">
            <CardHeader className="pb-4 bg-muted/10 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        <div>
                            <CardTitle className="text-xl font-serif">Token & Latency Metrics</CardTitle>
                            <CardDescription>
                                Total: {tokenUsage.total_tokens.toLocaleString()} tokens
                            </CardDescription>
                        </div>
                    </div>

                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="w-full grid grid-cols-4 mb-8 bg-muted/20 p-1 rounded-full">
                        <TabsTrigger value="summary" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Summary</TabsTrigger>
                        <TabsTrigger value="stage1" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Opinions</TabsTrigger>
                        <TabsTrigger value="stage2" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Review</TabsTrigger>
                        <TabsTrigger value="stage3" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Synthesis</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <TabContentLayout
                            isSummary
                            distribution={summaryDistribution}
                            stats={{
                                prompt: tokenUsage.total_prompt_tokens,
                                completion: tokenUsage.total_completion_tokens,
                                total: tokenUsage.total_tokens,
                                durationMs: latencyStats?.total_duration_ms
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="stage1" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <TabContentLayout
                            distribution={stage1Distribution}
                            latencyDistribution={stage1Latency}
                            stats={{
                                prompt: tokenUsage.stage1_opinions?.total_prompt_tokens || 0,
                                completion: tokenUsage.stage1_opinions?.total_completion_tokens || 0,
                                total: tokenUsage.stage1_opinions?.total_tokens || 0
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="stage2" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <TabContentLayout
                            distribution={stage2Distribution}
                            latencyDistribution={stage2Latency}
                            stats={{
                                prompt: tokenUsage.stage2_review?.total_prompt_tokens || 0,
                                completion: tokenUsage.stage2_review?.total_completion_tokens || 0,
                                total: tokenUsage.stage2_review?.total_tokens || 0
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="stage3" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <TabContentLayout
                            distribution={stage3Distribution}
                            latencyDistribution={stage3Latency}
                            stats={{
                                prompt: tokenUsage.stage3_synthesis?.total_prompt_tokens || 0,
                                completion: tokenUsage.stage3_synthesis?.total_completion_tokens || 0,
                                total: tokenUsage.stage3_synthesis?.total_tokens || 0
                            }}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
