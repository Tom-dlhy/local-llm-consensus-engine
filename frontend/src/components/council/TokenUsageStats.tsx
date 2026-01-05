/**
 * TokenUsageStats Component
 * Displays token usage metrics per stage and totals
 */

import * as React from 'react'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import type { SessionTokenUsage, StageTokenUsage } from '~/types/council'

interface TokenUsageStatsProps {
    tokenUsage: SessionTokenUsage
}

function StageBreakdown({ stage }: { stage: StageTokenUsage | null }) {
    if (!stage) {
        return (
            <p className="text-sm text-muted-foreground py-4 text-center">
                No data available
            </p>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-2xl font-bold">{stage.total_prompt_tokens.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Prompt</p>
                </div>
                <div>
                    <p className="text-2xl font-bold">{stage.total_completion_tokens.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Completion</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-primary">{stage.total_tokens.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                </div>
            </div>

            {Object.keys(stage.by_model).length > 0 && (
                <div className="border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">By Model</p>
                    <div className="space-y-2">
                        {Object.entries(stage.by_model).map(([model, usage]) => (
                            <div key={model} className="flex items-center justify-between text-sm">
                                <span className="font-mono text-xs">{model}</span>
                                <span className="text-muted-foreground">
                                    {usage.total_tokens.toLocaleString()} tokens
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export function TokenUsageStats({ tokenUsage }: TokenUsageStatsProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <div>
                        <CardTitle className="text-lg">Token Usage</CardTitle>
                        <CardDescription>
                            Total: {tokenUsage.total_tokens.toLocaleString()} tokens
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="summary">
                    <TabsList className="w-full">
                        <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
                        <TabsTrigger value="stage1" className="flex-1">Opinions</TabsTrigger>
                        <TabsTrigger value="stage2" className="flex-1">Review</TabsTrigger>
                        <TabsTrigger value="stage3" className="flex-1">Synthesis</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="mt-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold">{tokenUsage.total_prompt_tokens.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Total Prompt</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{tokenUsage.total_completion_tokens.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Total Completion</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary">{tokenUsage.total_tokens.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">Grand Total</p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="stage1" className="mt-4">
                        <StageBreakdown stage={tokenUsage.stage1_opinions} />
                    </TabsContent>

                    <TabsContent value="stage2" className="mt-4">
                        <StageBreakdown stage={tokenUsage.stage2_review} />
                    </TabsContent>

                    <TabsContent value="stage3" className="mt-4">
                        <StageBreakdown stage={tokenUsage.stage3_synthesis} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
