"use client";

import Link from "next/link";
import useSWR from "swr";
import { Loader2, Users } from "lucide-react";

import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type RosterStudent = {
    id: string;
    matricule: string;
    user: { firstName: string; lastName: string; isActive: boolean };
};

/**
 * Effectif réel d'une classe (GET /api/students?classId=, plafond de sécurité
 * côté serveur ; un enseignant ne voit que ses classes). L'onglet affichait une
 * carte figée « Les élèves inscrits apparaîtront ici » sans jamais les lister.
 */
export function ClassRoster({ classId, canEnroll }: { classId: string; canEnroll: boolean }) {
    const { data, error, isLoading } = useSWR<{ data: RosterStudent[] }>(
        `/api/students?classId=${encodeURIComponent(classId)}`,
        fetcher,
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12" role="status" aria-label="Chargement de l'effectif">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }
    if (error) {
        return (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                Impossible de charger l&apos;effectif : {error.message}
            </div>
        );
    }

    const students = [...(data?.data ?? [])].sort(
        (a, b) => a.user.lastName.localeCompare(b.user.lastName, "fr") || a.user.firstName.localeCompare(b.user.firstName, "fr"),
    );

    if (students.length === 0) {
        return (
            <Card className="border-2 border-dashed bg-muted/10 shadow-none">
                <CardContent className="py-16 text-center">
                    <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
                    <h3 className="text-lg font-medium">Aucun élève inscrit dans cette classe</h3>
                    {canEnroll ? (
                        <div className="mt-6 flex justify-center">
                            <Link href="/dashboard/students/inscription">
                                <Button variant="outline">Inscrire un élève</Button>
                            </Link>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="m-0 text-sm text-muted-foreground">
                    {students.length} élève{students.length > 1 ? "s" : ""} inscrit{students.length > 1 ? "s" : ""}
                </p>
                {canEnroll ? (
                    <Link href="/dashboard/students/inscription">
                        <Button variant="outline" size="sm">Inscrire un élève</Button>
                    </Link>
                ) : null}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/60">
                <table className="w-full min-w-[360px] text-sm">
                    <caption className="sr-only">Élèves de la classe</caption>
                    <thead className="bg-muted/30 text-left text-xs font-bold text-muted-foreground">
                        <tr>
                            <th scope="col" className="w-10 px-3 py-2">N°</th>
                            <th scope="col" className="px-3 py-2">Élève</th>
                            <th scope="col" className="px-3 py-2">Matricule</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s, i) => (
                            <tr key={s.id} className="border-t border-border/50">
                                <td className="px-3 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                                <th scope="row" className="px-3 py-2 text-left font-medium">
                                    <Link href={`/dashboard/students/${s.id}`} className="text-foreground hover:underline">
                                        {s.user.lastName} {s.user.firstName}
                                    </Link>
                                    {!s.user.isActive ? <span className="ml-2 text-xs text-muted-foreground">(compte désactivé)</span> : null}
                                </th>
                                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{s.matricule}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
