"use client";

import * as React from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { Badge, Button, Card } from "@/components/edu";

type InvitationsResponse = {
    invitations: Array<{ id: string; createdAt: string; expiresAt: string }>;
    members: Array<{ teacherId: string; name: string; email: string; primarySchoolName: string | null; since: string | null }>;
};

const FR_DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Enseignants venus d'autres établissements (direction de l'école active) :
 * émettre un code d'invitation à usage unique (7 jours, montré une seule fois),
 * révoquer un code, retirer un enseignant rattaché (ses cours lui sont retirés,
 * ses notes restent).
 */
export function TeacherInvitationsPanel({ onMembersChanged }: { onMembersChanged?: () => void }) {
    const { data, error, isLoading, mutate } = useSWR<InvitationsResponse>("/api/teacher-invitations", fetcher);
    const [creating, setCreating] = React.useState(false);
    const [freshCode, setFreshCode] = React.useState<{ code: string; expiresAt: string } | null>(null);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);

    async function createCode() {
        setCreating(true);
        try {
            const res = await fetch("/api/teacher-invitations", { method: "POST" });
            const body = (await res.json().catch(() => ({}))) as { code?: string; expiresAt?: string; error?: string };
            if (!res.ok || !body.code || !body.expiresAt) {
                toast.error(body.error ?? "Le code n'a pas pu être créé.");
                return;
            }
            setFreshCode({ code: body.code, expiresAt: body.expiresAt });
            await mutate();
        } finally {
            setCreating(false);
        }
    }

    async function revoke(id: string) {
        setBusyId(id);
        try {
            const res = await fetch(`/api/teacher-invitations/${id}`, { method: "DELETE" });
            if (!res.ok) toast.error("Ce code n'a pas pu être révoqué.");
            else toast.success("Code révoqué.");
            await mutate();
        } finally {
            setBusyId(null);
        }
    }

    async function remove(teacherId: string, name: string) {
        setBusyId(teacherId);
        try {
            const res = await fetch(`/api/teachers/${teacherId}/membership`, { method: "DELETE" });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                toast.error(body.error ?? "Impossible de retirer cet enseignant.");
                return;
            }
            toast.success(`${name} ne fait plus partie de l'établissement.`, { description: "Ses cours ont été retirés ; ses notes restent." });
            setConfirmRemove(null);
            await mutate();
            onMembersChanged?.();
        } finally {
            setBusyId(null);
        }
    }

    async function copy(code: string) {
        try {
            await navigator.clipboard.writeText(code);
            toast.success("Code copié.");
        } catch {
            toast.error("Copie impossible : notez le code à la main.");
        }
    }

    return (
        <Card padding={0}>
            <div
                className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4"
                style={{ borderColor: "var(--eduflow-border-subtle)" }}
            >
                <div className="min-w-0">
                    <h2 className="eduflow-display m-0 text-base">Enseignants d&apos;autres établissements</h2>
                    <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--eduflow-text-secondary)" }}>
                        Pour un enseignant qui a déjà un compte EduPilot dans une autre école : remettez-lui un code,
                        il le saisit dans <em>Mon profil</em>.
                    </p>
                </div>
                <Button icon="plus" loading={creating} onClick={() => void createCode()}>
                    Créer un code
                </Button>
            </div>

            <div className="space-y-4 px-5 py-4">
                {freshCode ? (
                    <div
                        role="status"
                        className="rounded-lg p-3"
                        style={{ background: "var(--brand-50)", border: "1px solid var(--brand-200)" }}
                    >
                        <p className="m-0 text-[12px] font-semibold" style={{ color: "var(--brand-700)" }}>
                            Code à remettre à l&apos;enseignant (affiché une seule fois)
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="eduflow-display text-xl font-bold tracking-widest tabular-nums" aria-label={`Code ${freshCode.code.split("").join(" ")}`}>
                                {freshCode.code}
                            </span>
                            <Button size="sm" variant="secondary" onClick={() => void copy(freshCode.code)}>
                                Copier
                            </Button>
                        </div>
                        <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--eduflow-text-secondary)" }}>
                            Valable jusqu&apos;au {FR_DATE.format(new Date(freshCode.expiresAt))}, pour une seule personne.
                        </p>
                    </div>
                ) : null}

                {isLoading ? (
                    <p className="m-0 text-[13px]" role="status" style={{ color: "var(--eduflow-text-tertiary)" }}>
                        Chargement…
                    </p>
                ) : error ? (
                    <p role="alert" className="m-0 text-[13px] text-destructive">
                        Impossible de charger les invitations.
                    </p>
                ) : (
                    <>
                        <section aria-labelledby="ti-members">
                            <h3 id="ti-members" className="m-0 mb-2 text-[12px] font-bold" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                Enseignants rattachés · {data?.members.length ?? 0}
                            </h3>
                            {data && data.members.length > 0 ? (
                                <ul className="m-0 list-none space-y-2 p-0">
                                    {data.members.map((m) => (
                                        <li key={m.teacherId} className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold">{m.name || m.email}</div>
                                                <div className="truncate text-[12px]" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                                    {m.primarySchoolName ? `École principale : ${m.primarySchoolName}` : m.email}
                                                </div>
                                            </div>
                                            {confirmRemove === m.teacherId ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        loading={busyId === m.teacherId}
                                                        onClick={() => void remove(m.teacherId, m.name || m.email)}
                                                    >
                                                        Confirmer le retrait
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                                                        Annuler
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="secondary" onClick={() => setConfirmRemove(m.teacherId)}>
                                                    Retirer
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="m-0 text-[13px]" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                    Aucun enseignant rattaché depuis une autre école.
                                </p>
                            )}
                        </section>

                        <section aria-labelledby="ti-codes">
                            <h3 id="ti-codes" className="m-0 mb-2 text-[12px] font-bold" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                Codes en circulation · {data?.invitations.length ?? 0}
                            </h3>
                            {data && data.invitations.length > 0 ? (
                                <ul className="m-0 list-none space-y-2 p-0">
                                    {data.invitations.map((inv) => (
                                        <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                                            <span>
                                                Créé le {FR_DATE.format(new Date(inv.createdAt))}{" "}
                                                <Badge variant="neutral" size="sm">
                                                    expire le {FR_DATE.format(new Date(inv.expiresAt))}
                                                </Badge>
                                            </span>
                                            <Button size="sm" variant="ghost" loading={busyId === inv.id} onClick={() => void revoke(inv.id)}>
                                                Révoquer
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="m-0 text-[13px]" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                    Aucun code en circulation.
                                </p>
                            )}
                        </section>
                    </>
                )}
            </div>
        </Card>
    );
}
