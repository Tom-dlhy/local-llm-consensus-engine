/**
 * StageProgress Component
 * Shows current workflow stage with progress indicators
 */

import * as React from 'react'
import { Loader2, CheckCircle2, Zap, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { SessionStage } from '~/types/council'

interface StageProgressProps {
    stage: SessionStage | null
    status: 'idle' | 'loading' | 'complete' | 'error'
    agentCount: number
    opinionsCount: number
    reviewsCount: number
}

const STAGE_LABELS: Record<SessionStage, string> = {
    [SessionStage.PENDING]: 'Pending',
    [SessionStage.OPINIONS]: 'Stage 1: Collecting Opinions',
    [SessionStage.REVIEW]: 'Stage 2: Peer Review',
    [SessionStage.SYNTHESIS]: 'Stage 3: Chairman Synthesis',
    [SessionStage.COMPLETE]: 'Complete',
    [SessionStage.ERROR]: 'Error',
}

export function StageProgress({
    stage,
    status,
    agentCount,
    opinionsCount,
    reviewsCount,
}: StageProgressProps) {
    const getStatusIcon = () => {
        switch (status) {
            case 'loading':
                return <Loader2 className="w-4 h-4 animate-spin text-primary" />
            case 'complete':
                return <CheckCircle2 className="w-4 h-4 text-green-600" />
            case 'error':
                return <AlertCircle className="w-4 h-4 text-destructive" />
            default:
                return null
        }
    }

    const getStageDetail = () => {
        if (!stage) return null

        switch (stage) {
            case SessionStage.OPINIONS:
                return `Collecting opinions from ${opinionsCount} / ${agentCount} agents`
            case SessionStage.REVIEW:
                return `Peer review in progress (${reviewsCount} agents reviewed)`
            case SessionStage.SYNTHESIS:
                return 'Chairman synthesizing final answer...'
            case SessionStage.COMPLETE:
                return 'All stages complete'
            default:
                return null
        }
    }

    const getVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
        if (status === 'error') return 'destructive'
        if (status === 'complete') return 'default'
        return 'secondary'
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Current Stage</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                    <Badge variant={getVariant()}>
                        {stage ? STAGE_LABELS[stage] : 'Unknown'}
                    </Badge>
                    {getStatusIcon()}
                </div>

                {getStageDetail() && (
                    <p className="text-sm text-muted-foreground">{getStageDetail()}</p>
                )}
            </CardContent>
        </Card>
    )
}
