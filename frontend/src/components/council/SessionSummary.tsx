/**
 * SessionSummary Component
 * Summary bar showing agent/opinion/review counts
 */

import * as React from 'react'
import { Users, MessageSquare, Award } from 'lucide-react'
import { Card, CardContent } from '~/components/ui/card'

interface SessionSummaryProps {
    agentCount: number
    opinionsCount: number
    reviewsCount: number
}

export function SessionSummary({
    agentCount,
    opinionsCount,
    reviewsCount,
}: SessionSummaryProps) {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>
                            <strong>{agentCount}</strong> agents
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <span>
                            <strong>{opinionsCount}</strong> opinions
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <span>
                            <strong>{reviewsCount}</strong> reviews
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
