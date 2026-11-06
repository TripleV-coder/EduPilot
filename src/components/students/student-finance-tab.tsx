"use client";

import Link from "next/link";
import useSWR from "swr";
import { Banknote, Loader2 } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Card, CardContent } from "@/components/ui/card";

type Balance = {
  feeId: string;
  feeName: string;
  billed: number;
  paid: number;
  pending: number;
  remaining: number;
};

const FCFA = new Intl.NumberFormat("fr-FR");
const money = (n: number) => `${FCFA.format(Math.round(n))} FCFA`;

/**
 * Situation financière réelle de l'élève, frais par frais (année courante),
 * lue sur /api/students/[id]/balances (même calcul que le guichet : paiements
 * validés nets des remboursements). L'onglet affichait en dur « État financier
 * non disponible ». Réservé à la direction et au comptable.
 */
export function StudentFinanceTab({ studentId }: { studentId: string }) {
  const { data, error, isLoading } = useSWR<{ balances: Balance[] }>(
    `/api/students/${encodeURIComponent(studentId)}/balances`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Chargement de la situation financière">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Impossible de charger la situation financière : {error.message}
      </div>
    );
  }

  const balances = data?.balances ?? [];
  if (balances.length === 0) {
    return (
      <Card className="border-none bg-muted/20 shadow-none">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Banknote className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-bold text-muted-foreground">Aucun frais applicable à cet élève sur l&apos;année en cours.</p>
        </CardContent>
      </Card>
    );
  }

  const total = balances.reduce(
    (acc, b) => ({ billed: acc.billed + b.billed, paid: acc.paid + b.paid, pending: acc.pending + b.pending, remaining: acc.remaining + b.remaining }),
    { billed: 0, paid: 0, pending: 0, remaining: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Facturé", total.billed],
          ["Encaissé", total.paid],
          ["En attente", total.pending],
          ["Reste à payer", total.remaining],
        ].map(([label, value]) => (
          <Card key={label as string} className="border-none bg-muted/20 shadow-none">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-muted-foreground">{label}</p>
              <p className="mt-1 text-base font-bold tabular-nums">{money(value as number)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-[520px] text-[13px]">
          <caption className="sr-only">Situation par frais</caption>
          <thead className="bg-muted/30 text-left text-xs font-bold text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">Frais</th>
              <th scope="col" className="px-3 py-2 text-right">Facturé</th>
              <th scope="col" className="px-3 py-2 text-right">Encaissé</th>
              <th scope="col" className="px-3 py-2 text-right">En attente</th>
              <th scope="col" className="px-3 py-2 text-right">Reste</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.feeId} className="border-t border-border/50">
                <th scope="row" className="px-3 py-2 text-left font-semibold">{b.feeName}</th>
                <td className="px-3 py-2 text-right tabular-nums">{money(b.billed)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(b.paid)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{b.pending > 0 ? money(b.pending) : "—"}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${b.remaining > 0 ? "text-destructive" : ""}`}>
                  {money(b.remaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link href={`/dashboard/finance/payments/new?studentId=${encodeURIComponent(studentId)}`} className="inline-block text-sm font-semibold text-primary">
        Encaisser un paiement pour cet élève
      </Link>
    </div>
  );
}
