"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export type JustificationRow = {
    id: string;
    studentName: string;
    className: string;
    date: string;
    status: "ABSENT" | "LATE" | "EXCUSED";
    reason: string | null;
    pendingReview: boolean;
    submittedBy?: string | null;
};

const STATUS_LABEL: Record<JustificationRow["status"], string> = {
    ABSENT: "Absence",
    LATE: "Retard",
    EXCUSED: "Justifiée",
};

export const formatDay = (value: string) =>
    new Date(value).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/**
 * Assiduité vue par la famille : absences et retards de ses enfants (ou de
 * l'élève lui-même) et envoi d'un justificatif, validé ensuite par l'établissement.
 */
export function FamilyAttendance({ role }: { role: "PARENT" | "STUDENT" }) {
    const { toast } = useToast();
    const { data, error, isLoading, mutate } = useSWR<{ justifications: JustificationRow[] }>(
        "/api/attendance/justifications",
        fetcher,
    );
    const [target, setTarget] = useState<JustificationRow | null>(null);
    const [reason, setReason] = useState("");
    const [sending, setSending] = useState(false);

    const rows = data?.justifications ?? [];

    const send = async () => {
        if (!target) return;
        setSending(true);
        try {
            const res = await fetch("/api/attendance/justifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attendanceId: target.id, reason: reason.trim() }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Le justificatif n'a pas été envoyé.");
            toast({ title: "Justificatif envoyé", description: "L'établissement va l'examiner." });
            setTarget(null);
            setReason("");
            await mutate();
        } catch (err) {
            toast({ title: "Envoi impossible", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <PageShell>
            <PageHeader
                title={role === "PARENT" ? "Assiduité de mes enfants" : "Mon assiduité"}
                description="Absences et retards relevés à l'appel. Justifiez-les ici : l'établissement valide ensuite."
                breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Assiduité" }]}
            />

            {isLoading ? <PageLoading label="Chargement des absences…" /> : null}
            {error ? <PageError message="Impossible de charger les absences." onRetry={() => void mutate()} /> : null}
            {!isLoading && !error && rows.length === 0 ? (
                <PageEmpty icon="check" title="Aucune absence ni aucun retard" description="Rien à justifier pour le moment." />
            ) : null}

            {rows.length > 0 ? (
                <ul className="space-y-3">
                    {rows.map((row) => {
                        const canJustify = row.status !== "EXCUSED" && !row.pendingReview;
                        return (
                            <li key={row.id}>
                                <Card>
                                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                                        <div className="min-w-0">
                                            <p className="font-semibold">
                                                {role === "PARENT" ? `${row.studentName} · ` : ""}
                                                {formatDay(row.date)}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {row.className}
                                                {row.reason ? ` · Motif : ${row.reason}` : ""}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {row.pendingReview ? (
                                                <Badge variant="secondary">Justificatif en attente</Badge>
                                            ) : (
                                                <Badge variant={row.status === "EXCUSED" ? "default" : "destructive"}>{STATUS_LABEL[row.status]}</Badge>
                                            )}
                                            {canJustify ? (
                                                <Button size="sm" onClick={() => setTarget(row)}>
                                                    Justifier
                                                </Button>
                                            ) : null}
                                        </div>
                                    </CardContent>
                                </Card>
                            </li>
                        );
                    })}
                </ul>
            ) : null}

            <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Justifier {target ? `${target.status === "LATE" ? "le retard" : "l'absence"} du ${formatDay(target.date)}` : ""}</DialogTitle>
                        <DialogDescription>
                            Indiquez le motif. Un certificat ou un document peut être remis à la vie scolaire.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="justification-reason">Motif</Label>
                        <Textarea
                            id="justification-reason"
                            rows={4}
                            placeholder="Ex : fièvre, consultation au centre de santé ; certificat remis au secrétariat."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTarget(null)}>Annuler</Button>
                        <Button onClick={() => void send()} disabled={sending || reason.trim().length < 3}>
                            Envoyer le justificatif
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
