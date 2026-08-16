"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type PieLabel,
  type PieProps,
} from "recharts";
import { FR_TOOLTIP_STYLE } from "./chart-theme";
import React from "react";

export interface BasePieChartDataItem {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}

export interface BasePieChartProps {
  data: BasePieChartDataItem[];
  height?: number | `${number}%`;
  innerRadius?: number;
  outerRadius?: number;
  paddingAngle?: number;
  emptyMessage?: React.ReactNode;
  colors?: string[];
  cx?: PieProps["cx"];
  cy?: PieProps["cy"];
  onClick?: (entry: BasePieChartDataItem, index: number) => void;
  activeIndex?: number | null;
  labelLine?: boolean;
  label?: PieLabel;
}

export function BasePieChart({
  data,
  height = 250,
  innerRadius = 60,
  outerRadius = 80,
  paddingAngle = 3,
  emptyMessage = "Aucune donnée disponible",
  colors = [],
  cx,
  cy,
  onClick,
  activeIndex,
  labelLine,
  label
}: BasePieChartProps) {
  const isEmpty = !data || data.length === 0 || data.every(d => d.value === 0);

  if (isEmpty) {
    return (
      <div 
        className="flex items-center justify-center text-muted-foreground text-sm" 
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={paddingAngle}
          labelLine={labelLine}
          label={label}
          onClick={(_data, index) => {
            if (!onClick || index < 0 || index >= data.length) return;
            onClick(data[index], index);
          }}
        >
          {data.map((entry, index) => {
             const opacity = (activeIndex !== undefined && activeIndex !== null && activeIndex !== index) ? 0.5 : 1;
             return (
               <Cell 
                 key={index} 
                 fill={entry.color || entry.fill || colors[index % colors.length] || "#ccc"} 
                 opacity={opacity}
                 cursor={onClick ? "pointer" : "default"}
               />
             );
          })}
        </Pie>
        <Tooltip contentStyle={FR_TOOLTIP_STYLE.contentStyle} />
        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
