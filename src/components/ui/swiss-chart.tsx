"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SwissBarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  showValues?: boolean;
  className?: string;
  barHeight?: number;
  monochrome?: boolean;
}

export function SwissBarChart({
  data,
  maxValue,
  showValues = true,
  className,
  barHeight = 8,
  monochrome = true,
}: SwissBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value));

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item, index) => {
        const percentage = (item.value / max) * 100;
        const color = monochrome
          ? `hsl(var(--foreground) / ${0.3 + (percentage / 100) * 0.7})`
          : item.color || "hsl(var(--primary))";

        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-text-primary font-medium">{item.label}</span>
              {showValues && (
                <span className="text-text-secondary tabular-nums">
                  {item.value.toLocaleString()}
                </span>
              )}
            </div>
            <div
              className="w-full bg-border rounded-sm overflow-hidden"
              style={{ height: barHeight }}
            >
              <div
                className="h-full rounded-sm transition-all duration-500 ease-out"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SwissMiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  className?: string;
}

export function SwissMiniChart({
  data,
  width = 120,
  height = 40,
  strokeColor = "hsl(var(--foreground))",
  fillColor = "hsl(var(--foreground) / 0.1)",
  strokeWidth = 1.5,
  className,
}: SwissMiniChartProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      style={{ width, height }}
    >
      {/* Fill area */}
      <path d={areaD} fill={fillColor} />
      {/* Stroke line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface SwissSparklineProps {
  data: number[];
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function SwissSparkline({
  data,
  trend = "neutral",
  className,
}: SwissSparklineProps) {
  const trendColors = {
    up: { stroke: "hsl(var(--success))", fill: "hsl(var(--success) / 0.15)" },
    down: { stroke: "hsl(var(--destructive))", fill: "hsl(var(--destructive) / 0.15)" },
    neutral: { stroke: "hsl(var(--foreground))", fill: "hsl(var(--foreground) / 0.08)" },
  };

  const colors = trendColors[trend];

  return (
    <SwissMiniChart
      data={data}
      width={80}
      height={24}
      strokeColor={colors.stroke}
      fillColor={colors.fill}
      strokeWidth={2}
      className={className}
    />
  );
}

interface SwissStatsGridProps {
  stats: {
    label: string;
    value: string | number;
    change?: string;
    trend?: "up" | "down" | "neutral";
    sparklineData?: number[];
  }[];
  className?: string;
}

export function SwissStatsGrid({ stats, className }: SwissStatsGridProps) {
  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3", className)}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="p-3 bg-[hsl(var(--surface-base))] border border-border rounded-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-text-primary tabular-nums">
                {stat.value}
              </p>
              {stat.change && (
                <p
                  className={cn(
                    "mt-0.5 text-[11px] font-medium",
                    stat.trend === "up" && "text-success",
                    stat.trend === "down" && "text-destructive",
                    stat.trend === "neutral" && "text-text-secondary"
                  )}
                >
                  {stat.change}
                </p>
              )}
            </div>
            {stat.sparklineData && (
              <SwissSparkline
                data={stat.sparklineData}
                trend={stat.trend}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Example data generators
export const generateTrendData = (points: number, trend: "up" | "down" | "mixed" = "mixed"): number[] => {
  const data: number[] = [];
  let value = 50;

  for (let i = 0; i < points; i++) {
    if (trend === "up") {
      value += Math.random() * 10 - 2;
    } else if (trend === "down") {
      value -= Math.random() * 10 - 2;
    } else {
      value += Math.random() * 20 - 10;
    }
    value = Math.max(10, Math.min(90, value));
    data.push(value);
  }

  return data;
};

export default SwissBarChart;
