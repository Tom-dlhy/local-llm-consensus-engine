/**
 * QueryForm Component
 * Query textarea with submit button
 */

import * as React from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'

interface QueryFormProps {
    query: string
    onQueryChange: (value: string) => void
    onSubmit: () => void
    isLoading: boolean
    disabled?: boolean
    error?: string | null
}

export function QueryForm({
    query,
    onQueryChange,
    onSubmit,
    isLoading,
    disabled = false,
    error,
}: QueryFormProps) {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSubmit()
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="query" className="text-sm font-semibold">
                    Your Question
                </Label>
                <textarea
                    id="query"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Ask the council a question..."
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    rows={4}
                />
            </div>

            {error && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            <Button
                type="submit"
                disabled={isLoading || disabled}
                className="w-full"
                size="lg"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Council in Progress...
                    </>
                ) : (
                    <>
                        <Send className="w-5 h-5 mr-2" />
                        Submit to Council
                    </>
                )}
            </Button>
        </form>
    )
}
