'use client'

import React from 'react'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export interface LineChartDataPoint {
  date: string
  [key: string]: string | number
}

interface LineChartProps {
  data: LineChartDataPoint[]
  /** Keys to plot as lines. Defaults to all numeric keys in the first row. */
  lines?: Array<{
    dataKey: string
    label?: string
    color?: string
  }>
  /** Label for the X axis */
  xLabel?: string
  /** Label for the Y axis */
  yLabel?: string
  /** Height in pixels (default 300) */
  height?: number
  /** Format Y-axis tick values */
  yTickFormatter?: (value: number) => string
  /**
   * Custom tooltip value formatter. Uses Recharts' own signature so TypeScript
   * is happy: (value, name) => [formattedValue, formattedName]
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tooltipFormatter?: (value: any, name: any) => [string, string]
}

const DEFAULT_COLORS = [
  '#d97706', // amber-600
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#9333ea', // purple-600
]

export function LineChart({
  data,
  lines,
  xLabel,
  yLabel,
  height = 300,
  yTickFormatter,
  tooltipFormatter,
}: LineChartProps) {
  // Derive line config from data keys when not provided explicitly
  const resolvedLines =
    lines ??
    (data.length > 0
      ? Object.keys(data[0])
          .filter((k) => k !== 'date' && typeof data[0][k] === 'number')
          .map((key, i) => ({
            dataKey: key,
            label: key,
            color: DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          }))
      : [])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart
        data={data}
        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          label={
            xLabel
              ? { value: xLabel, position: 'insideBottom', offset: -5 }
              : undefined
          }
          tick={{ fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: 'insideLeft', offset: 10 }
              : undefined
          }
          tickFormatter={yTickFormatter}
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          // cast to suppress the overly-strict Recharts generic
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={tooltipFormatter as any}
          contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
        />
        {resolvedLines.length > 1 && <Legend />}
        {resolvedLines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.label ?? line.dataKey}
            stroke={line.color ?? DEFAULT_COLORS[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
