"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { Block, Figures, MODULE, WatchList } from "@/components/edu-homes/home-kit";

type PendingAction = {
    id: string;
    type: string;
    description: string;
    count: number;
    priority: "high" | "medium" | "low";
    url: string;
};

type SystemInfo = {
    system?: { version?: string; nodeVersion?: string; environment?: string; uptime?: number };
    database?: {
        provider?: string;
        status?: string;
        users?: number;
        schools?: number;
        students?: number;
        teachers?: number;
        grades?: number;
    };
    activity?: { logs24h?: number };
};

const fmt = (n: number | undefined) => (typeof n === "number" ? n.toLocaleString("fr-FR") : "—");
const PRIORITY_COLOR: Record<PendingAction["priority"], string> = {
    high: MODULE.pink,
    medium: MODULE.orange,
    low: MODULE.blue,
};

export default function AdminPage() {
    // Le garde enveloppe le composant qui charge : aucune requête ne part pour
    // un rôle non autorisé (sinon trois 403 à chaque visite).
    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <AdminContent />
        </PageGuard>
    );
}

function AdminContent() {
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [info, setInfo] = useState<SystemInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch("/api/admin/system/info", { credentials: "include" }).then((r) => {
                if (!r.ok) throw new Error("Impossible de charger les informations système.");
                return r.json() as Promise<SystemInfo>;
            }),
            fetch("/api/admin/pending-actions", { credentials: "include" })
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null),
        ])
            .then(([infoData, actionsData]) => {
                if (cancelled) return;
                setInfo(infoData);
                const list: PendingAction[] = Array.isArray(actionsData) ? actionsData : actionsData?.actions ?? [];
                setPendingActions(list.filter((a) => a.count > 0));
            })
            .catch((e: Error) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const db = info?.database;
    const uptimeHours = info?.system?.uptime ? Math.floor(info.system.uptime / 3600) : null;

    return (
        <PageShell>
            <PageHeader
                title="Administration"
                description="État de la plateforme et actions à traiter"
                breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Administration" }]}
            />

            {loading ? <PageLoading label="Chargement de l'administration…" /> : null}
            {error ? <PageError message={error} onRetry={() => window.location.reload()} /> : null}

            {!loading && !error && info ? (
                <div className="space-y-4">
                    <Block id="admin-overview" title="Vue d'ensemble">
                        <Figures
                            items={[
                                { label: "Comptes", value: fmt(db?.users), note: "utilisateurs enregistrés", color: MODULE.blue, href: "/dashboard/root-control/users" },
                                { label: "Établissements", value: fmt(db?.schools), note: `${fmt(db?.students)} élèves`, color: MODULE.green, href: "/dashboard/root-control/schools" },
                                { label: "Enseignants", value: fmt(db?.teachers), note: `${fmt(db?.grades)} notes saisies`, color: MODULE.orange },
                                { label: "Journal", value: fmt(info.activity?.logs24h), note: "actions sur 24 h", color: MODULE.purple, href: "/dashboard/root-control/logs" },
                            ]}
                        />
                    </Block>

                    <Block id="admin-pending" title="À traiter">
                        <WatchList
                            calm="Rien à traiter pour l'instant."
                            items={pendingActions.map((a) => ({
                                key: a.id,
                                avatar: String(a.count),
                                color: PRIORITY_COLOR[a.priority] ?? MODULE.blue,
                                name: a.description,
                                detail: `${a.count} élément${a.count > 1 ? "s" : ""} en attente`,
                                action: { href: a.url, label: "Ouvrir" },
                            }))}
                        />
                    </Block>

                    <Block id="admin-system" title="Informations système">
                        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                            {[
                                ["Version", info.system?.version ?? "—"],
                                ["Environnement", info.system?.environment === "production" ? "Production" : info.system?.environment ?? "—"],
                                ["Base de données", `${db?.provider ?? "—"} · ${db?.status === "connected" ? "connectée" : db?.status ?? "—"}`],
                                ["En service depuis", uptimeHours === null ? "—" : `${uptimeHours} h`],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <dt style={{ color: "var(--eduflow-text-secondary)" }}>{label}</dt>
                                    <dd style={{ margin: "2px 0 0", fontWeight: 600 }}>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </Block>
                </div>
            ) : null}
        </PageShell>
    );
}
