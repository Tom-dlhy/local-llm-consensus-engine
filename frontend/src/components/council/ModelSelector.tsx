/**
 * ModelSelector Component
 * Grid of model checkboxes for agent selection
 */

import * as React from 'react'
import { Card, CardContent } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { Label } from '~/components/ui/label'
import type { ModelInfo } from '~/types/council'

interface ModelSelectorProps {
    models: ModelInfo[]
    selectedModels: Set<string>
    onToggle: (modelName: string) => void
    disabled?: boolean
}

export function ModelSelector({
    models,
    selectedModels,
    onToggle,
    disabled = false,
}: ModelSelectorProps) {
    return (
        <div className="space-y-3">
            <Label className="text-sm font-semibold">
                Select Models ({selectedModels.size} selected)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {models.map((model) => (
                    <Card
                        key={model.name}
                        className={`cursor-pointer transition-all hover:border-primary/50 ${selectedModels.has(model.name) ? 'border-primary bg-primary/5' : ''
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !disabled && onToggle(model.name)}
                    >
                        <CardContent className="flex items-start gap-3 p-4">
                            <Checkbox
                                id={`model-${model.name}`}
                                checked={selectedModels.has(model.name)}
                                onCheckedChange={() => onToggle(model.name)}
                                disabled={disabled}
                                className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                                <Label
                                    htmlFor={`model-${model.name}`}
                                    className="font-medium cursor-pointer"
                                >
                                    {model.display_name}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {model.size} • {model.description}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
