"use client";

import * as React from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { Badge, Button, Card, Input } from "@/components/edu";
import { useSchool } from "@/components/providers/school-provider";

type MySchool = { id: string; name: string; primary: boolean; since: string | null };

/**
 * « Mes établissements » (enseignant) : rejoindre une école avec le code
 * qu'elle a remis, passer de l'une à l'autre, quitter une école rattachée.
 * L'école principale porte le compte et ne se quitte pas d'ici.
 */
export function MySchoolsCard() {
    const { data, error, isLoading, mutate } = useSWR<{ schools: MySchool[] }>("/api/me/schools", fetcher);
    const { mutate: mutateAll } = useSWRConfig();
    const { schoolId: activeSchoolId, setActiveSchoolId } = useSchool();
    const [code, setCode] = React.useState("");
    const [joining, setJoining] = React.useState(false);
    const [joinError, setJoinError] = React.useState<string | null>(null);
    const [leavingId, setLeavingId] = React.useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = React.useState<string | null>(null);

    const refreshSchoolLists = async () => {
        await mutate();
        // Sélecteur d'école : la liste vient de /api/schools/context
        await mutateAll((key) => typeof key === "string" && key.startsWith("/api/schools/context"));
    };

    async function join(event: React.FormEvent) {
        event.preventDefault();
        setJoinError(null);
        setJoining(true);
        try {
            const res = await fetch("/api/me/schools", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string; schoolName?: string; alreadyMember?: boolean };
            if (!res.ok) {
                setJoinError(body.error ?? "Le code n'a pas pu être vérifié.");
                return;
            }
            setCode("");
            toast.success(
                body.alreadyMember ? `Vous faites déjà partie de ${body.schoolName}.` : `Vous avez rejoint ${body.schoolName}.`,
                { description: "Choisissez l'établissement dans le sélecteur d'école pour y travailler." },
            );
            await refreshSchoolLists();
        } catch {
            setJoinError("Connexion impossible. Réessayez.");
        } finally {
            setJoining(false);
        }
    }

    async function leave(school: MySchool) {
        setLeavingId(school.id);
        try {
            const res = await fetch(`/api/me/schools/${school.id}`, { method: "DELETE" });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error ?? "Impossible de quitter cet établissement.");
                return;
            }
            toast.success(`Vous avez quitté ${school.name}.`, { description: "Vos cours y ont été retirés ; vos notes restent." });
            setConfirmLeave(null);
            if (activeSchoolId === school.id) {
                const primary = data?.schools.find((s) => s.primary);
                if (primary) await setActiveSchoolId(primary.id);
            }
            await refreshSchoolLists();
        } finally {
            setLeavingId(null);
        }
    }

    return (
        <Card padding={0}>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                <h2 className="eduflow-display m-0 text-base">Mes établissements</h2>
                <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--eduflow-text-secondary)" }}>
                    Vous enseignez dans plusieurs écoles ? Saisissez le code que l&apos;établissement vous a remis.
                </p>
            </div>

            <div className="space-y-3 px-5 py-4">
                {isLoading ? (
                    <p className="m-0 text-[13px]" style={{ color: "var(--eduflow-text-tertiary)" }} role="status">
                        Chargement…
                    </p>
                ) : error ? (
                    <p role="alert" className="m-0 text-[13px] text-destructive">
                        Impossible de charger vos établissements.
                    </p>
                ) : (
                    <ul className="m-0 list-none space-y-2 p-0">
                        {(data?.schools ?? []).map((school) => (
                            <li key={school.id} className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-semibold">{school.name}</span>
                                    {school.primary ? (
                                        <Badge variant="brand" size="sm">Principal</Badge>
                                    ) : null}
                                    {school.id === activeSchoolId ? (
                                        <Badge variant="success" size="sm">Ouvert</Badge>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    {school.id !== activeSchoolId ? (
                                        <Button size="sm" variant="ghost" onClick={() => void setActiveSchoolId(school.id)}>
                                            Ouvrir
                                        </Button>
                                    ) : null}
                                    {!school.primary ? (
                                        confirmLeave === school.id ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    loading={leavingId === school.id}
                                                    onClick={() => void leave(school)}
                                                >
                                                    Confirmer
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setConfirmLeave(null)}>
                                                    Annuler
                                                </Button>
                                            </>
                                        ) : (
                                            <Button size="sm" variant="secondary" onClick={() => setConfirmLeave(school.id)}>
                                                Quitter
                                            </Button>
                                        )
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <form onSubmit={join} className="flex flex-wrap items-start gap-2 pt-1">
                    <div className="min-w-[200px] flex-1">
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="Code d'invitation (ex. K7M2Q-PRXA9)"
                            aria-label="Code d'invitation de l'établissement"
                            autoComplete="off"
                            required
                        />
                    </div>
                    <Button type="submit" loading={joining} disabled={code.trim().length < 10}>
                        Rejoindre
                    </Button>
                </form>
                {joinError ? (
                    <p role="alert" className="m-0 text-[13px] text-destructive">
                        {joinError}
                    </p>
                ) : null}

                <Link href="/dashboard/my-availability" className="inline-block text-[13px] font-semibold text-primary">
                    Mes disponibilités (une grille pour toutes vos écoles)
                </Link>
            </div>
        </Card>
    );
}
