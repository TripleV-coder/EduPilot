"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageError, PageLoading } from "@/components/layout/page-states";
import { Button, Icon, Input } from "@/components/edu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { CARD_COLORS } from "@/components/edu-homes/home-kit";
import homeStyles from "@/components/edu-homes/home.module.css";

type Club = {
    id: string;
    name: string;
    category: string;
    description: string | null;
    schedule: string | null;
    capacity: number | null;
    supervisor: { id: string; name: string } | null;
    memberCount: number;
    joined: boolean;
};

type ClubsResponse = { canManage: boolean; clubs: Club[] };
type Teacher = { id: string; user?: { firstName?: string; lastName?: string } };

type Draft = {
    id?: string;
    name: string;
    category: string;
    description: string;
    schedule: string;
    supervisorId: string;
    capacity: string;
};

const EMPTY_DRAFT: Draft = { name: "", category: "", description: "", schedule: "", supervisorId: "", capacity: "" };

async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Action impossible.");
    return data;
}

/* Clubs de l'établissement, en cartes à bandeau façon Google Classroom
   (docs/design/directions/live). Données réelles : /api/clubs. */
export default function ClubsPage() {
    const { data, error, isLoading, mutate } = useSWR<ClubsResponse>("/api/clubs", fetcher);
    const canManage = data?.canManage ?? false;
    const { data: teachersData } = useSWR<unknown>(canManage ? "/api/teachers?limit=100" : null, fetcher);
    const teachers: Teacher[] = Array.isArray(teachersData)
        ? (teachersData as Teacher[])
        : ((teachersData as { data?: Teacher[] } | undefined)?.data ?? []);

    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [archiveTarget, setArchiveTarget] = useState<Club | null>(null);

    const clubs = data?.clubs ?? [];
    const joinedCount = clubs.filter((c) => c.joined).length;

    const saveDraft = async () => {
        if (!draft) return;
        setSaving(true);
        try {
            const body = {
                name: draft.name,
                category: draft.category,
                description: draft.description || null,
                schedule: draft.schedule || null,
                supervisorId: draft.supervisorId || null,
                capacity: draft.capacity ? Number(draft.capacity) : null,
            };
            await send(draft.id ? `/api/clubs/${draft.id}` : "/api/clubs", draft.id ? "PATCH" : "POST", body);
            toast.success(draft.id ? "Club modifié." : "Club créé.");
            setDraft(null);
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action impossible.");
        } finally {
            setSaving(false);
        }
    };

    const toggleMembership = async (club: Club) => {
        setBusyId(club.id);
        try {
            await send(`/api/clubs/${club.id}/members`, club.joined ? "DELETE" : "POST");
            toast.success(club.joined ? `Vous avez quitté ${club.name}.` : `Vous avez rejoint ${club.name}.`);
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action impossible.");
        } finally {
            setBusyId(null);
        }
    };

    const archive = async () => {
        if (!archiveTarget) return;
        try {
            await send(`/api/clubs/${archiveTarget.id}`, "DELETE");
            toast.success("Club archivé.");
            setArchiveTarget(null);
            await mutate();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Action impossible.");
        }
    };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "STAFF"]}>
            <PageShell>
                <PageHeader
                    title="Clubs et activités"
                    description={
                        isLoading
                            ? "Chargement…"
                            : `${clubs.length} club${clubs.length > 1 ? "s" : ""}${
                                  canManage ? "" : ` · ${joinedCount} rejoint${joinedCount > 1 ? "s" : ""}`
                              }`
                    }
                    breadcrumbs={[{ label: "Vie scolaire" }, { label: "Clubs et activités" }]}
                    actions={
                        canManage ? (
                            <Button icon="plus" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
                                Nouveau club
                            </Button>
                        ) : null
                    }
                />

                {isLoading ? <PageLoading label="Chargement des clubs…" /> : null}
                {error ? <PageError message="Impossible de charger les clubs." onRetry={() => void mutate()} /> : null}
                {!isLoading && !error && clubs.length === 0 ? (
                    <PageEmpty
                        icon="trophy"
                        title="Aucun club pour l'instant"
                        description={
                            canManage
                                ? "Créez le premier club : robotique, théâtre, football, chorale…"
                                : "L'établissement n'a pas encore ouvert de club."
                        }
                    />
                ) : null}

                {clubs.length > 0 ? (
                    <div className={homeStyles.classes}>
                        {clubs.map((club, index) => {
                            const full = club.capacity !== null && club.memberCount >= club.capacity && !club.joined;
                            return (
                                <div key={club.id} className={homeStyles.classCard} style={{ position: "relative" }}>
                                    <div className={homeStyles.banner} style={{ background: CARD_COLORS[index % CARD_COLORS.length] }}>
                                        <span className={homeStyles.className} style={{ paddingRight: 32 }}>{club.name}</span>
                                        <span className={homeStyles.classMeta}>
                                            {[club.category, club.schedule].filter(Boolean).join(" · ")}
                                        </span>
                                    </div>
                                    <div style={{ padding: "10px 14px 0", fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                        {club.description ? <p style={{ margin: "0 0 6px" }}>{club.description}</p> : null}
                                        <p style={{ margin: 0 }}>
                                            {club.supervisor ? `Responsable : ${club.supervisor.name}` : "Responsable à désigner"}
                                        </p>
                                    </div>
                                    <div className={homeStyles.classBody} style={{ alignItems: "center" }}>
                                        <span>
                                            {club.memberCount}
                                            {club.capacity ? ` / ${club.capacity}` : ""} membre{club.memberCount > 1 ? "s" : ""}
                                        </span>
                                        {!canManage ? (
                                            <Button
                                                size="sm"
                                                variant={club.joined ? "secondary" : "primary"}
                                                loading={busyId === club.id}
                                                disabled={full || busyId === club.id}
                                                onClick={() => toggleMembership(club)}
                                            >
                                                {club.joined ? "Quitter" : full ? "Complet" : "Rejoindre"}
                                            </Button>
                                        ) : null}
                                    </div>
                                    {canManage ? (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions pour le club ${club.name}`}
                                                    className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                                >
                                                    <Icon name="more" size={18} color="#fff" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" className="w-48 p-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDraft({
                                                            id: club.id,
                                                            name: club.name,
                                                            category: club.category,
                                                            description: club.description ?? "",
                                                            schedule: club.schedule ?? "",
                                                            supervisorId: club.supervisor?.id ?? "",
                                                            capacity: club.capacity ? String(club.capacity) : "",
                                                        })
                                                    }
                                                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--eduflow-surface-sunken)]"
                                                >
                                                    Modifier
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setArchiveTarget(club)}
                                                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--eduflow-danger-50)]"
                                                    style={{ color: "var(--eduflow-danger-700)" }}
                                                >
                                                    Archiver
                                                </button>
                                            </PopoverContent>
                                        </Popover>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : null}

                <Dialog open={draft !== null} onOpenChange={(open) => (!open ? setDraft(null) : undefined)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{draft?.id ? "Modifier le club" : "Nouveau club"}</DialogTitle>
                        </DialogHeader>
                        {draft ? (
                            <div className="grid gap-4">
                                <Input label="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                                <Input
                                    label="Catégorie"
                                    placeholder="Sciences, arts, sport…"
                                    value={draft.category}
                                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                                    required
                                />
                                <Input
                                    label="Horaire"
                                    placeholder="Mercredi 15 h – 17 h"
                                    value={draft.schedule}
                                    onChange={(e) => setDraft({ ...draft, schedule: e.target.value })}
                                />
                                <Input
                                    label="Places (facultatif)"
                                    type="number"
                                    min={1}
                                    value={draft.capacity}
                                    onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
                                />
                                <label className="grid gap-1.5 text-[13px] font-semibold">
                                    Responsable
                                    <select
                                        value={draft.supervisorId}
                                        onChange={(e) => setDraft({ ...draft, supervisorId: e.target.value })}
                                        className="h-10 rounded-input border px-3 text-sm font-normal"
                                        style={{ borderColor: "var(--eduflow-border-default)", background: "var(--eduflow-surface-card)" }}
                                    >
                                        <option value="">À désigner</option>
                                        {teachers.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {`${t.user?.firstName ?? ""} ${t.user?.lastName ?? ""}`.trim() || "Enseignant"}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <Input
                                    label="Description (facultatif)"
                                    value={draft.description}
                                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                />
                            </div>
                        ) : null}
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setDraft(null)}>
                                Annuler
                            </Button>
                            <Button icon="check" loading={saving} disabled={saving} onClick={saveDraft}>
                                Enregistrer
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <ConfirmActionDialog
                    open={archiveTarget !== null}
                    onOpenChange={(open) => (!open ? setArchiveTarget(null) : undefined)}
                    title={archiveTarget ? `Archiver le club ${archiveTarget.name} ?` : "Archiver ce club ?"}
                    description="Le club disparaît de la liste ; l'historique des membres est conservé."
                    confirmLabel="Archiver"
                    cancelLabel="Annuler"
                    variant="destructive"
                    onConfirm={archive}
                />
            </PageShell>
        </PageGuard>
    );
}
