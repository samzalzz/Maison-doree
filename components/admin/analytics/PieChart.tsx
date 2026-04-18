'use client'

import React from 'react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type PieLabelRenderProps,
} from 'recharts'

export interface PieChartDataPoint {
  name: string
  value: number
}

interface PieChartProps {
  data: PieChartDataPoint[]
  /** Height in pixels (default 300) */
  height?: number
  /** Whether to show a legend beneath the chart */
  showLegend?: boolean
  /** Inner radius (0 = solid pie, >0 = donut). Accepts number or "%" string */
  innerRadius?: number | string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tooltipFormatter?: (value: any, name: any) => [string, string]
}

const DEFAULT_COLORS = [
  '#d97706', // amber
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#9333ea', // purple
  '#0891b2', // cyan
  '#ea580c', // orange
  '#65a30d', // lime
]

function renderCustomLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props

  // Recharts passes all as number | undefined — guard them
  if (
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined ||
    percent === undefined
  ) {
    return null
  }

  const numCx = Number(cx)
  const numCy = Number(cy)
  const numMid = Number(midAngle)
  const numInner = Number(innerRadius)
  const numOuter = Number(outerRadius)
  const numPercent = Number(percent)

  if (numPercent < 0.05) return null // skip tiny slices

  const RADIAN = Math.PI / 180
  const radius = numInner + (numOuter - numInner) * 0.5
  const x = numCx + radius * Math.cos(-numMid * RADIAN)
  const y = numCy + radius * Math.sin(-numMid * RADIAN)

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {`${(numPercent * 100).toFixed(0)}%`}
    </text>
  )
}

export function PieChart({
  data,
  height = 300,
  showLegend = true,
  innerRadius = 0,
  tooltipFormatter,
}: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius="75%"
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={tooltipFormatter as any}
          contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
        />
        {showLegend && (
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            iconSize={10}
            formatter={(value) => (
              <span style={{ fontSize: '12px', color: '#374151' }}>{value}</span>
            )}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}
