/**
 * TokenUsageStats Component
 * Displays token usage metrics per stage and totals
 */

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { BarChart3 } from 'lucide-react'
import type { SessionTokenUsage, StageTokenUsage, SessionLatencyStats, StageLatencyStats, ReviewResult } from '~/types/council'
import { TokenDistributionChart } from './TokenDistributionChart'
import { LatencyBarChart } from './LatencyBarChart'
import { ModelRadarChart } from './ModelRadarChart'

interface TokenUsageStatsProps {
    tokenUsage: SessionTokenUsage
    latencyStats?: SessionLatencyStats
    reviews?: ReviewResult[]
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

export function TokenUsageStats({ tokenUsage, latencyStats, reviews }: TokenUsageStatsProps) {
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
                    <TabsList className="w-full grid grid-cols-5 mb-8 bg-muted/30 p-1 rounded-full">
                        <TabsTrigger value="summary" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Summary</TabsTrigger>
                        <TabsTrigger value="stage1" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Opinions</TabsTrigger>
                        <TabsTrigger value="stage2" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Review</TabsTrigger>
                        <TabsTrigger value="stage3" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Synthesis</TabsTrigger>
                        <TabsTrigger value="models" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Models</TabsTrigger>
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

                    <TabsContent value="models" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                        <ModelPerformanceRadar
                            tokenUsage={tokenUsage}
                            latencyStats={latencyStats}
                            reviews={reviews}
                        />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}


// Internal component for the Radar Logic
// Renders one Radar Chart per model

const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
]

function ModelPerformanceRadar({
    tokenUsage,
    latencyStats,
    reviews
}: {
    tokenUsage: SessionTokenUsage,
    latencyStats?: SessionLatencyStats,
    reviews?: import('~/types/council').ReviewResult[]
}) {
    // 1. Identify Models (Union of Stage 1 & 2)
    const models = Array.from(new Set([
        ...Object.keys(tokenUsage.stage1_opinions?.by_model || {}),
        ...Object.keys(tokenUsage.stage2_review?.by_model || {})
    ]));

    if (models.length === 0) {
        return <div className="p-8 text-center text-muted-foreground">No model data available</div>
    }

    // 2. Aggregate Data: Score, Latency S1, Latency S2, Tokens S1, Tokens S2

    // Helper to get score: Average score RECEIVED by a model in Stage 2 reviews
    const modelScores: Record<string, number> = {};
    if (reviews) {
        const agentIdToModel: Record<string, string> = {};
        reviews.forEach(r => {
            agentIdToModel[r.reviewer_id] = r.model;
        });

        const scoresSum: Record<string, number> = {};
        const scoresCount: Record<string, number> = {};

        reviews.forEach(r => {
            r.rankings.forEach(ranking => {
                const targetModel = agentIdToModel[ranking.agent_id];
                if (targetModel) {
                    scoresSum[targetModel] = (scoresSum[targetModel] || 0) + ranking.score;
                    scoresCount[targetModel] = (scoresCount[targetModel] || 0) + 1;
                }
            });
        });

        Object.keys(scoresSum).forEach(m => {
            modelScores[m] = scoresSum[m] / scoresCount[m];
        });
    }

    // 3. Prepare Metrics per model
    const s1Latency = latencyStats?.stage1_opinions?.by_model || {};
    const s2Latency = latencyStats?.stage2_review?.by_model || {};
    const s1Tokens = Object.fromEntries(
        Object.entries(tokenUsage.stage1_opinions?.by_model || {}).map(([m, u]) => [m, u.total_tokens])
    );
    const s2Tokens = Object.fromEntries(
        Object.entries(tokenUsage.stage2_review?.by_model || {}).map(([m, u]) => [m, u.total_tokens])
    );

    // 4. Normalize Data (0-100 scale)
    const getMax = (data: Record<string, number>) => Math.max(...Object.values(data), 1);

    const maxScore = 10;
    const maxS1Lat = getMax(s1Latency);
    const maxS2Lat = getMax(s2Latency);
    const maxS1Tok = getMax(s1Tokens);
    const maxS2Tok = getMax(s2Tokens);

    return (
        <div className="py-6 space-y-8">
            {/* Grid of individual radar charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {models.map((model, idx) => {
                    const score = modelScores[model] || 0;
                    const lat1 = s1Latency[model] || 0;
                    const lat2 = s2Latency[model] || 0;
                    const tok1 = s1Tokens[model] || 0;
                    const tok2 = s2Tokens[model] || 0;

                    const data = [
                        { metric: "Score", value: (score / maxScore) * 100 },
                        { metric: "Lat S1", value: (lat1 / maxS1Lat) * 100 },
                        { metric: "Lat S2", value: (lat2 / maxS2Lat) * 100 },
                        { metric: "Tok S1", value: (tok1 / maxS1Tok) * 100 },
                        { metric: "Tok S2", value: (tok2 / maxS2Tok) * 100 },
                    ];

                    return (
                        <ModelRadarChart
                            key={model}
                            modelName={model}
                            data={data}
                            color={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
                    );
                })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 text-center text-sm">
                <div className="p-2 bg-muted/10 rounded">
                    <p className="font-semibold text-muted-foreground">Score</p>
                    <p className="text-xs opacity-70">(Higher is better)</p>
                </div>
                <div className="p-2 bg-muted/10 rounded">
                    <p className="font-semibold text-muted-foreground">Lat S1</p>
                    <p className="text-xs opacity-70">(Opinions)</p>
                </div>
                <div className="p-2 bg-muted/10 rounded">
                    <p className="font-semibold text-muted-foreground">Lat S2</p>
                    <p className="text-xs opacity-70">(Review)</p>
                </div>
                <div className="p-2 bg-muted/10 rounded">
                    <p className="font-semibold text-muted-foreground">Tok S1</p>
                    <p className="text-xs opacity-70">(Opinions)</p>
                </div>
                <div className="p-2 bg-muted/10 rounded">
                    <p className="font-semibold text-muted-foreground">Tok S2</p>
                    <p className="text-xs opacity-70">(Review)</p>
                </div>
            </div>
        </div>
    )
}
