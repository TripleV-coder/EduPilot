"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PeriodRow = { periodId: string; name: string; sequence: number; average: number | null; originSchool: string | null };

/**
 * Élève transféré : moyennes des périodes suivies dans l'établissement
 * d'origine (bulletin de transfert). Elles comptent dans la moyenne annuelle
 * pour une période sans note chez vous. Réservé à la direction.
 */
export function ExternalAveragesCard({ studentId }: { studentId: string }) {
    const { data, error, mutate } = useSWR<{ periods: PeriodRow[] }>(`/api/students/${studentId}/external-averages`, fetcher);
    const [drafts, setDrafts] = useState<Record<string, { average: string; origin: string }>>({});
    const [busy, setBusy] = useState<string | null>(null);

    if (error) return null; // rôle sans accès ou panne : la carte ne gêne pas la fiche
    const periods = data?.periods ?? [];
    if (data && periods.length === 0) return null;

    const draftOf = (p: PeriodRow) => drafts[p.periodId] ?? { average: p.average === null ? "" : String(p.average).replace(".", ","), origin: p.originSchool ?? "" };

    const save = async (p: PeriodRow, clear = false) => {
        const d = draftOf(p);
        const value = clear ? null : Number(d.average.replace(",", "."));
        if (!clear && (!Number.isFinite(value) || (value as number) < 0 || (value as number) > 20)) {
            toast.error("Moyenne entre 0 et 20.");
            return;
        }
        setBusy(p.periodId);
        try {
            const res = await fetch(`/api/students/${studentId}/external-averages`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ periodId: p.periodId, average: value === null ? null : Math.round((value as number) * 100) / 100, originSchool: d.origin.trim() || undefined }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error || "La moyenne d'origine n'a pas été enregistrée.");
                return;
            }
            toast.success(clear ? "Moyenne d'origine effacée." : "Moyenne d'origine enregistrée ; les moyennes sont recalculées.");
            setDrafts((prev) => {
                const next = { ...prev };
                delete next[p.periodId];
                return next;
            });
            await mutate();
        } catch {
            toast.error("Connexion impossible : rien n'a été enregistré.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Moyennes de l&apos;établissement d&apos;origine</CardTitle>
                <p className="text-sm text-muted-foreground">
                    Pour un élève arrivé en cours d&apos;année : la moyenne lue sur son bulletin de transfert compte pour une période sans note chez vous.
                </p>
            </CardHeader>
            <CardContent className="space-y-3">
                {periods.map((p) => {
                    const d = draftOf(p);
                    return (
                        <div key={p.periodId} className="grid gap-2 sm:grid-cols-[140px_110px_1fr_auto] sm:items-end">
                            <p className="text-sm font-medium">{p.name}</p>
                            <label className="text-xs">
                                <span className="text-muted-foreground">Moyenne /20</span>
                                <Input
                                    inputMode="decimal"
                                    value={d.average}
                                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.periodId]: { ...d, average: e.target.value } }))}
                                />
                            </label>
                            <label className="text-xs">
                                <span className="text-muted-foreground">Établissement d&apos;origine</span>
                                <Input
                                    value={d.origin}
                                    maxLength={160}
                                    onChange={(e) => setDrafts((prev) => ({ ...prev, [p.periodId]: { ...d, origin: e.target.value } }))}
                                />
                            </label>
                            <div className="flex gap-2">
                                <Button size="sm" disabled={busy === p.periodId || !d.average.trim()} onClick={() => void save(p)}>Enregistrer</Button>
                                {p.average !== null ? (
                                    <Button size="sm" variant="ghost" disabled={busy === p.periodId} onClick={() => void save(p, true)}>Effacer</Button>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
