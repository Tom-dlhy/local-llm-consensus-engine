/**
 * EmptyState Component
 * Displayed when there's no session or data
 */

import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '~/components/ui/card'

interface EmptyStateProps {
    title: string
    message: string
}

export function EmptyState({ title, message }: EmptyStateProps) {
    return (
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div>
                        <p className="font-medium text-amber-900 dark:text-amber-100">{title}</p>
                        <p className="text-sm text-amber-700 dark:text-amber-200">{message}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
