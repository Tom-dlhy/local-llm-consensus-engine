/**
 * OpinionCard Component
 * Displays a single agent opinion from Stage 1 using an Accordion
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
import type { AgentResponse } from '~/types/council'

interface OpinionCardProps {
    opinion: AgentResponse
}

export function OpinionCard({ opinion }: OpinionCardProps) {
    return (
        <Card>
            <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex flex-col items-start text-left">
                                <span className="text-lg font-semibold">{opinion.agent_name}</span>
                                <span className="text-xs text-muted-foreground font-normal mt-1">
                                    {opinion.model} • {opinion.duration_ms}ms
                                </span>
                            </div>
                            <Badge variant="secondary" className="ml-2 w-fit">
                                {opinion.agent_id}
                            </Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                        <div className="mb-4">
                            <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
                                <span className="font-semibold text-primary/80">Stats:</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="cursor-help underline decoration-dotted">
                                                {opinion.tokens_used} tokens used
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Prompt: {opinion.prompt_tokens}</p>
                                            <p>Completion: {opinion.completion_tokens}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-md border text-sm leading-relaxed whitespace-pre-wrap">
                                {opinion.content || <span className="italic text-muted-foreground">No content received from model. Check backend logs.</span>}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    )
}
