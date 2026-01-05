/**
 * FinalAnswerCard Component
 * Displays the Chairman's synthesized final answer
 */

import * as React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '~/components/ui/card'
import type { FinalAnswer } from '~/types/council'

interface FinalAnswerCardProps {
    answer: FinalAnswer
}

export function FinalAnswerCard({ answer }: FinalAnswerCardProps) {
    return (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <CardTitle className="text-green-900 dark:text-green-100">
                        Chairman's Final Answer
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {answer.content}
                </p>
            </CardContent>
            <CardFooter className="border-t border-green-200 dark:border-green-800 pt-4">
                <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                    <span>Model: {answer.chairman_model}</span>
                    <div className="flex items-center gap-4">
                        <span>{answer.tokens_used} tokens</span>
                        <span>{answer.duration_ms}ms</span>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}
