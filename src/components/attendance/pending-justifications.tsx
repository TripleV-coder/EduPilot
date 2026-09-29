"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDay, type JustificationRow } from "./family-attendance";

/**
 * Justificatifs envoyés par les familles, à valider (→ absence justifiée) ou
 * refuser (la famille est prévenue). Rien n'est affiché s'il n'y en a pas.
 */
export function PendingJustifications() {
    const { toast } = useToast();
    const { data, mutate } = useSWR<{ justifications: JustificationRow[] }>(
        "/api/attendance/justifications?pending=true",
        fetcher,
    );
    const [busyId, setBusyId] = useState<string | null>(null);
    const rows = data?.justifications ?? [];

    if (rows.length === 0) return null;

    const decide = async (row: JustificationRow, decision: "APPROVE" | "REJECT") => {
        setBusyId(row.id);
        try {
            const res = await fetch("/api/attendance/justifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attendanceId: row.id, decision }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Opération refusée.");
            toast({
                title: decision === "APPROVE" ? "Absence justifiée" : "Justificatif refusé",
                description: `${row.studentName} · ${formatDay(row.date)}`,
            });
            await mutate();
        } catch (err) {
            toast({ title: "Échec", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Card className="border-primary/30">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Justificatifs à traiter ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="divide-y divide-border">
                    {rows.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                                <p className="font-medium">
                                    {row.studentName} · {row.className}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {row.status === "LATE" ? "Retard" : "Absence"} du {formatDay(row.date)}
                                    {row.submittedBy ? ` · envoyé par ${row.submittedBy}` : ""}
                                </p>
                                {row.reason ? <p className="text-sm mt-1">« {row.reason} »</p> : null}
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => void decide(row, "REJECT")}>
                                    Refuser
                                </Button>
                                <Button size="sm" disabled={busyId === row.id} onClick={() => void decide(row, "APPROVE")}>
                                    Valider
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
