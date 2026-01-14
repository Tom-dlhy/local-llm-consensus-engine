"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, PolarRadiusAxis } from "recharts"

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "~/components/ui/chart"

export interface SingleModelRadarData {
    metric: string
    value: number
}

interface ModelRadarChartProps {
    modelName: string
    data: SingleModelRadarData[]
    color?: string
}

export function ModelRadarChart({
    modelName,
    data,
    color = "hsl(var(--chart-1))"
}: ModelRadarChartProps) {

    const chartConfig: ChartConfig = {
        value: {
            label: modelName,
            color: color,
        },
    }

    return (
        <Card className="flex flex-col h-full shadow-sm">
            <CardHeader className="items-center pb-2 pt-4">
                <CardTitle className="text-sm font-medium">{modelName}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 flex-1">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[200px] w-full"
                >
                    <RadarChart data={data} outerRadius="75%">
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel indicator="line" />}
                        />
                        <PolarGrid className="text-muted-foreground/20" />
                        <PolarAngleAxis
                            dataKey="metric"
                            tick={{ fill: "currentColor", fontSize: 10 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                        <Radar
                            name={modelName}
                            dataKey="value"
                            stroke={color}
                            fill={color}
                            fillOpacity={0.4}
                            dot={{
                                r: 2,
                                fillOpacity: 1,
                            }}
                        />
                    </RadarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
