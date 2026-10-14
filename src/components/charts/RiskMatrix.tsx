"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Matrice des risques sur des MESURES RÉELLES (aucun pourcentage inventé) :
 *   - axe horizontal : taux d'absence de l'élève (100 − assiduité) ;
 *   - axe vertical : écart de la moyenne sous le seuil de passage.
 * Les lignes médianes sont placées aux seuils de l'école (assiduité faible,
 * seuil de passage) : à droite = absences au-delà du seuil d'alerte, en haut
 * = moyenne sous le seuil de passage. Un élève sans moyenne ou sans appel
 * n'est pas placé (une donnée absente n'est pas 0).
 */
export interface RiskMatrixPoint {
  id: string;
  name: string;
  className: string;
  /** Taux d'absence en % (null : aucun appel enregistré). */
  absenceRate: number | null;
  /** Moyenne générale /20 (null : pas encore de moyenne). */
  average: number | null;
}

type RiskMatrixProps = {
  students: RiskMatrixPoint[];
  /** Taux d'absence à partir duquel l'assiduité est « faible » (100 − seuil d'assiduité). */
  absenceAlert: number;
  /** Seuil de passage de l'école. */
  passingGrade: number;
};

const clamp = (v: number) => Math.max(2, Math.min(98, v));
const fr = (n: number, digits = 0) => n.toFixed(digits).replace(".", ",");

export function RiskMatrix({ students, absenceAlert, passingGrade }: RiskMatrixProps) {
  // Seuil au milieu de chaque axe : 0 % → gauche, 2 × seuil d'alerte → droite ;
  // 20/20 → bas, 2 × (20 − passage) sous 20 → haut.
  const xOf = (absence: number) => clamp((absence / Math.max(2 * absenceAlert, 1)) * 100);
  const yOf = (average: number) => clamp(((20 - average) / Math.max(2 * (20 - passingGrade), 1)) * 100);
  const placed = students.filter(
    (s): s is RiskMatrixPoint & { absenceRate: number; average: number } => s.absenceRate !== null && s.average !== null
  );
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
        <div className="absolute top-2 left-2 text-[11px] font-bold text-destructive tracking-tighter">Moyenne sous {fr(passingGrade, Number.isInteger(passingGrade) ? 0 : 2)}</div>
        <div className="absolute bottom-2 right-2 text-[11px] font-bold text-destructive tracking-tighter">Absences &gt; {fr(absenceAlert)} %</div>
        
        <div className="absolute top-4 right-4 text-[11px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">RISQUE CRITIQUE</div>
        <div className="absolute bottom-4 left-4 text-[11px] font-bold text-emerald-800 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">STABILITÉ</div>

        {/* Points */}
        {placed.map((s) => {
          const absent = s.absenceRate > absenceAlert;
          const failing = s.average < passingGrade;
          return (
          <Tooltip key={s.id}>
            <TooltipTrigger asChild>
              <div 
                className={cn(
                  "absolute w-3 h-3 rounded-full border-2 border-background shadow-sm cursor-pointer transition-transform hover:scale-150 z-10",
                  absent && failing ? "bg-destructive animate-pulse" :
                  absent || failing ? "bg-orange-500" : "bg-emerald-500"
                )}
                style={{
                  left: `${xOf(s.absenceRate)}%`,
                  bottom: `${yOf(s.average)}%`,
                  transform: 'translate(-50%, 50%)'
                }}
              />
            </TooltipTrigger>
            <TooltipContent className="p-2 space-y-1">
              <p className="text-xs font-bold">{s.name}</p>
              <p className="text-[11px] text-muted-foreground">{s.className}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[11px] font-medium px-1 bg-muted rounded">Absences : {fr(s.absenceRate, 1)} %</span>
                <span className="text-[11px] font-medium px-1 bg-muted rounded">Moyenne : {fr(s.average, 2)}/20</span>
              </div>
            </TooltipContent>
          </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
