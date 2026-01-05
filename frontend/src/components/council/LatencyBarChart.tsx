"use client"

import * as React from "react"
import { TrendingUp } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "~/components/ui/chart"

export interface LatencyBarChartProps {
    distribution: Record<string, number>
    title?: string
    description?: string
    footerText?: string
}

export function LatencyBarChart({
    distribution,
    title = "Latency by Model",
    description = "Duration in milliseconds",
    footerText = "End-to-end processing time per model"
}: LatencyBarChartProps) {
    const chartData = React.useMemo(() => {
        return Object.entries(distribution).map(([model, ms], index) => {
            const safeKey = model.replace(/[^a-zA-Z0-9]/g, "_")
            return {
                model: safeKey, // safe key for config lookups
                displayModel: model, // original string for axis labels
                latency: ms,
                fill: `var(--color-${safeKey})`,
            }
        })
    }, [distribution])

    const chartConfig = React.useMemo(() => {
        const config: ChartConfig = {
            latency: {
                label: "Latency (ms)",
            },
        }

        // Dynamically assign colors
        chartData.forEach((item, index) => {
            const colorIndex = (index % 5) + 1
            config[item.model] = {
                label: item.displayModel,
                color: `var(--chart-${colorIndex})`,
            }
        })

        return config
    }, [chartData])

    if (chartData.length === 0) {
        return (
            <Card className="flex flex-col h-full bg-transparent border-0 shadow-none">
                <CardHeader className="items-center pb-0">
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>No data available</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0 flex items-center justify-center min-h-[250px] text-muted-foreground">
                    No active latency data
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="flex flex-col h-full bg-transparent border-0 shadow-none">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="max-h-[250px] w-full">
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            top: 20,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="displayModel"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                            dataKey="latency"
                            radius={8}
                        >
                            {/* We need to apply dynamic fill per bar, but recharts <Bar> takes a single fill prop usually.
                                However, Shadcn/UI charts usually handle this via CSS variables if data keys match config.
                                But here we have 1 series 'latency' with different colors per category.
                                Recharts supports Cell if we want individual colors, or we can use the `fill` from data if we map it properly inside Cell?
                                Actually Shadcn chart pattern usually relies on strict series.
                                
                                Let's try attempting to map each bar's fill to the payload.fill.
                                Standard Recharts way:
                            */}
                            <LabelList
                                position="top"
                                offset={12}
                                className="fill-foreground"
                                fontSize={12}
                                formatter={(value: number) => `${value}ms`}
                            />
                        </Bar>
                    </BarChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 leading-none font-medium">
                    {footerText} <TrendingUp className="h-4 w-4" />
                </div>
            </CardFooter>
        </Card>
    )
}
