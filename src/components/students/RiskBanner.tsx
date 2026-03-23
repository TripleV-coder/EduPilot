"use client";

import { AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskBannerProps {
  score: number; // 0-100
  label: string;
  responsibleName?: string;
}

export function RiskBanner({ score, label, responsibleName }: RiskBannerProps) {
  const isHigh = score >= 75;
  const isMedium = score >= 40 && score < 75;
  
  const config = isHigh 
    ? { icon: ShieldAlert, bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive" }
    : isMedium 
    ? { icon: AlertCircle, bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-600" }
    : { icon: CheckCircle2, bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-600" };

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border-2 mb-6",
      config.bg, config.border
    )}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-full bg-background/50", config.text)}>
          <config.icon className="w-5 h-5" />
        </div>
        <div>
          <p className={cn("text-xs font-bold uppercase tracking-widest", config.text)}>Score de Risque : {score}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Statut actuel : <span className="font-bold text-foreground">{label}</span></p>
        </div>
      </div>
      
      {responsibleName && (
        <div className="flex items-center gap-3 px-4 py-2 bg-background/40 rounded-lg border border-border/50">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
            {responsibleName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Responsable Suivi</p>
            <p className="text-xs font-bold text-foreground">{responsibleName}</p>
          </div>
        </div>
      )}
    </div>
  );
}
