'use client'

import React from 'react'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'

export interface BarChartDataPoint {
  name: string
  [key: string]: string | number
}

interface BarConfig {
  dataKey: string
  label?: string
  color?: string
}

interface BarChartProps {
  data: BarChartDataPoint[]
  /** Bars to render. Defaults to first numeric key in data. */
  bars?: BarConfig[]
  /** Height in pixels (default 300) */
  height?: number
  /** Vertical layout — useful for long category names */
  layout?: 'horizontal' | 'vertical'
  yTickFormatter?: (value: number) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tooltipFormatter?: (value: any, name: any) => [string, string]
  /** When true, each bar in a single-bar chart gets a different colour */
  multiColor?: boolean
}

const DEFAULT_COLORS = [
  '#d97706',
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ea580c',
]

export function BarChart({
  data,
  bars,
  height = 300,
  layout = 'horizontal',
  yTickFormatter,
  tooltipFormatter,
  multiColor = false,
}: BarChartProps) {
  const resolvedBars: BarConfig[] =
    bars ??
    (data.length > 0
      ? Object.keys(data[0])
          .filter((k) => k !== 'name' && typeof data[0][k] === 'number')
          .slice(0, 1)
          .map((key, i) => ({
            dataKey: key,
            label: key,
            color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          }))
      : [])

  const isVertical = layout === 'vertical'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 10, right: 20, left: 10, bottom: isVertical ? 5 : 30 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f0f0f0"
          horizontal={!isVertical}
          vertical={isVertical}
        />
        {isVertical ? (
          <>
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 12 }}
              tickLine={false}
              width={120}
            />
            <XAxis
              type="number"
              tickFormatter={yTickFormatter}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickLine={false}
              interval={0}
              angle={data.length > 6 ? -35 : 0}
              textAnchor={data.length > 6 ? 'end' : 'middle'}
            />
            <YAxis
              tickFormatter={yTickFormatter}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
          </>
        )}
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={tooltipFormatter as any}
          contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
        />
        {resolvedBars.length > 1 && <Legend />}
        {resolvedBars.map((bar) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.label ?? bar.dataKey}
            fill={bar.color ?? DEFAULT_COLORS[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={60}
          >
            {multiColor && resolvedBars.length === 1
              ? data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  />
                ))
              : null}
          </Bar>
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
