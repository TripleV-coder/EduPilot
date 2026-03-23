"use client";

import { Trophy, Medal, Star, TrendingUp } from "lucide-react";
import { CHART_COLORS } from "./chart-theme";
import { motion } from "framer-motion";

interface ClassRankingBarChartProps {
  data: Array<{ name: string; average: number }>;
}

function getScoreColor(average: number): string {
  if (average >= 16) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  if (average >= 14) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  if (average >= 12) return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
  if (average >= 10) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  return "text-destructive bg-destructive/10 border-destructive/20";
}

function getProgressColor(average: number): string {
  if (average >= 16) return "bg-emerald-500";
  if (average >= 14) return "bg-blue-500";
  if (average >= 12) return "bg-indigo-500";
  if (average >= 10) return "bg-amber-500";
  return "bg-destructive";
}

export function ClassRankingBarChart({ data }: ClassRankingBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm italic">
        Aucune donnée de classement disponible
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.average - a.average).slice(0, 6);

  return (
    <div className="w-full space-y-2 py-1">
      {sorted.map((entry, index) => {
        const rank = index + 1;
        const colorClass = getScoreColor(entry.average);
        const progressColor = getProgressColor(entry.average);
        
        return (
          <motion.div 
            key={entry.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative flex items-center gap-3 rounded-lg border border-transparent p-1.5 transition-all hover:bg-muted/50 hover:border-border"
          >
            {/* Rank Indicator - Smaller & Proportional */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/30 font-display font-bold text-xs">
              {rank === 1 ? (
                <Medal className="h-4 w-4 text-yellow-500 drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]" />
              ) : rank === 2 ? (
                <Medal className="h-4 w-4 text-gray-400" />
              ) : rank === 3 ? (
                <Medal className="h-4 w-4 text-amber-700" />
              ) : (
                <span className="text-muted-foreground/70">{rank}</span>
              )}
            </div>

            {/* Class Name & Info */}
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-semibold truncate text-[13px] leading-tight">
                  {entry.name}
                </span>
                <div className={`px-2 py-0.5 rounded-full border text-[10px] font-bold font-mono ${colorClass}`}>
                  {entry.average.toFixed(2)}
                </div>
              </div>
              
              {/* Discrete Progress Bar - Slimmer */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/40">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(entry.average / 20) * 100}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className={`h-full rounded-full ${progressColor} opacity-70 group-hover:opacity-100 transition-opacity`}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
