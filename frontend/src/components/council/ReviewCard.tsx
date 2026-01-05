/**
 * ReviewCard Component
 * Displays a single peer review with rankings from Stage 2 using an Accordion
 */

import * as React from 'react'
import { Card } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '~/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import type { ReviewResult } from '~/types/council'

interface ReviewCardProps {
    review: ReviewResult
}

function ScoreIndicator({ score }: { score: number }) {
    return (
        <div className="flex gap-0.5" title={`Score: ${score}/10`}>
            {[...Array(10)].map((_, i) => (
                <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i < score ? 'bg-amber-500' : 'bg-muted-foreground/20'
                        }`}
                />
            ))}
        </div>
    )
}

export function ReviewCard({ review }: ReviewCardProps) {
    const totalTokens = review.prompt_tokens + review.completion_tokens

    return (
        <Card>
            <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex flex-col items-start text-left">
                                <span className="text-lg font-semibold">{review.reviewer_name}</span>
                                <span className="text-xs text-muted-foreground font-normal mt-1">
                                    Reviewer • {review.rankings.length} rankings
                                </span>
                            </div>

                            {totalTokens > 0 && (
                                <div className="flex items-center mr-2">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className="font-normal text-xs text-muted-foreground cursor-help hover:bg-muted">
                                                    {totalTokens} tokens
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Prompt: {review.prompt_tokens}</p>
                                                <p>Completion: {review.completion_tokens}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            )}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                        <div className="space-y-3 pt-2">
                            {review.rankings.map((ranking, idx) => (
                                <div
                                    key={idx}
                                    className="flex flex-col sm:flex-row items-start gap-4 p-4 bg-muted/30 rounded-lg border"
                                >
                                    <div className="flex-1 space-y-2 w-full">
                                        <div className="flex items-center justify-between sm:justify-start sm:gap-4">
                                            <span className="font-semibold text-sm">
                                                Agent {ranking.agent_id.replace('agent_', '')}
                                            </span>
                                            <ScoreIndicator score={ranking.score} />
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {ranking.reasoning}
                                        </p>
                                    </div>
                                    <div className="text-right flex items-center gap-1 sm:block min-w-[3rem]">
                                        <span className="text-xl font-bold text-foreground">{ranking.score}</span>
                                        <span className="text-xs text-muted-foreground">/10</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    )
}
