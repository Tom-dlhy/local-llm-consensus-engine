"use client"

import * as React from "react"
import { TrendingUp } from "lucide-react"
import { Label, Pie, PieChart } from "recharts"

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

export interface TokenDistributionChartProps {
    distribution: Record<string, number>
    title?: string
    description?: string
    footerText?: string
}

export function TokenDistributionChart({
    distribution,
    title = "Token Distribution",
    description = "By Model",
    footerText = "Breakdown of token consumption"
}: TokenDistributionChartProps) {
    const chartData = React.useMemo(() => {
        return Object.entries(distribution).map(([model, tokens], index) => {
            // Create a safely sanitized key for config
            const safeKey = model.replace(/[^a-zA-Z0-9]/g, "_")
            return {
                model: safeKey, // Use safe key for mapping
                displayModel: model, // Keep original for display
                tokens: tokens,
                fill: `var(--color-${safeKey})`,
            }
        })
    }, [distribution])

    const totalTokens = React.useMemo(() => {
        return chartData.reduce((acc, curr) => acc + curr.tokens, 0)
    }, [chartData])

    const chartConfig = React.useMemo(() => {
        const config: ChartConfig = {
            tokens: {
                label: "Tokens",
            },
        }

        // Assign colors from chart-1 to chart-5 cyclically
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
                    No active data for this stage
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="flex flex-col h-full bg-transparent border-0 shadow-none">
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={chartData}
                            dataKey="tokens"
                            nameKey="model"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                            <Label
                                content={({ viewBox }) => {
                                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                        return (
                                            <text
                                                x={viewBox.cx}
                                                y={viewBox.cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                            >
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    className="fill-foreground text-3xl font-bold"
                                                >
                                                    {totalTokens.toLocaleString()}
                                                </tspan>
                                                <tspan
                                                    x={viewBox.cx}
                                                    y={(viewBox.cy || 0) + 24}
                                                    className="fill-muted-foreground"
                                                >
                                                    Tokens
                                                </tspan>
                                            </text>
                                        )
                                    }
                                }}
                            />
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm pt-4">
                <div className="flex items-center gap-2 leading-none font-medium">
                    {title} <TrendingUp className="h-4 w-4" />
                </div>
                <div className="text-muted-foreground leading-none text-center">
                    {footerText}
                </div>
            </CardFooter>
        </Card>
    )
}
