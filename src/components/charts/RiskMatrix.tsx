"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface RiskMatrixPoint {
  id: string;
  name: string;
  className: string;
  dropoutScore: number; // 0 to 100 (X axis)
  failureScore: number; // 0 to 100 (Y axis)
}

type RiskMatrixProps = {
  students: RiskMatrixPoint[];
};

export function RiskMatrix({ students }: RiskMatrixProps) {
  return (
    <TooltipProvider>
      <div className="relative w-full aspect-square border-2 border-border/50 bg-muted/10 rounded-xl overflow-hidden shadow-inner">
        {/* Axes */}
        <div className="absolute inset-0 flex">
           <div className="w-1/2 h-full border-r border-border/30 border-dashed" />
           <div className="w-1/2 h-full" />
        </div>
        <div className="absolute inset-0 flex flex-col">
           <div className="h-1/2 w-full border-b border-border/30 border-dashed" />
           <div className="h-1/2 w-full" />
        </div>

        {/* Labels Quadrants */}
        <div className="absolute top-2 left-2 text-[10px] font-bold text-destructive/40 uppercase tracking-tighter">Échec scolaire</div>
        <div className="absolute bottom-2 right-2 text-[10px] font-bold text-destructive/40 uppercase tracking-tighter">Décrochage</div>
        
        <div className="absolute top-4 right-4 text-[9px] font-bold text-destructive/60 bg-destructive/10 px-1.5 py-0.5 rounded-full">RISQUE CRITIQUE</div>
        <div className="absolute bottom-4 left-4 text-[9px] font-bold text-emerald-600/60 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">STABILITÉ</div>

        {/* Points */}
        {students.map((s) => (
          <Tooltip key={s.id}>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  "absolute w-3 h-3 rounded-full border-2 border-background shadow-sm cursor-pointer transition-transform hover:scale-150 z-10",
                  s.dropoutScore > 50 && s.failureScore > 50 ? "bg-destructive animate-pulse" :
                  s.dropoutScore > 50 || s.failureScore > 50 ? "bg-orange-500" : "bg-emerald-500"
                )}
                style={{
                  left: `${s.dropoutScore}%`,
                  bottom: `${s.failureScore}%`,
                  transform: 'translate(-50%, 50%)'
                }}
              />
            </TooltipTrigger>
            <TooltipContent className="p-2 space-y-1">
              <p className="text-xs font-bold">{s.name}</p>
              <p className="text-[10px] text-muted-foreground">{s.className}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[9px] font-medium px-1 bg-muted rounded">Décrochage: {s.dropoutScore}%</span>
                <span className="text-[9px] font-medium px-1 bg-muted rounded">Échec: {s.failureScore}%</span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
