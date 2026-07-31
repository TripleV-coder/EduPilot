"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

type StorageInfo = {
    used: number | null;
    quota: number | null;
};

type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const OFFLINE_FEATURES: { label: string; supported: boolean }[] = [
    { label: "Consultation dossier élève", supported: true },
    { label: "Saisie notes (file d'attente locale)", supported: false },
    { label: "Faire l'appel (file d'attente locale)", supported: false },
    { label: "Cahier de liaison · lecture", supported: true },
    { label: "Cahier de liaison · écriture", supported: false },
    { label: "Paiement Mobile Money", supported: false },
    { label: "SMS sortants", supported: false },
];

function fmtBytes(n: number | null): string {
    if (n === null) return "—";
    if (n < 1024) return `${n} o`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} Ko`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} Mo`;
    return `${(mb / 1024).toFixed(2)} Go`;
}

export default function OfflinePage() {
    const [online, setOnline] = useState<boolean>(true);
    const [lastSync, setLastSync] = useState<Date>(() => new Date());
    const [storage, setStorage] = useState<StorageInfo>({ used: null, quota: null });
    const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
    const [installing, setInstalling] = useState(false);
    const [installed, setInstalled] = useState(false);

    useEffect(() => {
        if (typeof navigator === "undefined") return;
        setOnline(navigator.onLine);

        const handleOnline = () => {
            setOnline(true);
            setLastSync(new Date());
        };
        const handleOffline = () => setOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        // Storage estimate
        if (navigator.storage && typeof navigator.storage.estimate === "function") {
            navigator.storage
                .estimate()
                .then((est) => {
                    setStorage({ used: est.usage ?? 0, quota: est.quota ?? null });
                })
                .catch(() => {
                    /* ignore */
                });
        }

        // PWA install prompt
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as InstallPromptEvent);
        };
        const handleInstalled = () => {
            setInstalled(true);
            setInstallPrompt(null);
        };
        window.addEventListener("beforeinstallprompt", handleBeforeInstall);
        window.addEventListener("appinstalled", handleInstalled);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
            window.removeEventListener("appinstalled", handleInstalled);
        };
    }, []);

    const minutesSinceSync = useMemo(() => {
        const ms = Date.now() - lastSync.getTime();
        return Math.floor(ms / 60000);
    }, [lastSync]);

    const handleInstall = async () => {
        if (!installPrompt) return;
        setInstalling(true);
        try {
            await installPrompt.prompt();
            const choice = await installPrompt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setInstallPrompt(null);
        } finally {
            setInstalling(false);
        }
    };

    const storagePct =
        storage.used !== null && storage.quota
            ? Math.min(100, (storage.used / storage.quota) * 100)
            : 0;

    return (
        <PageGuard permission={Permission.SCHOOL_READ}>
            <PageShell className="pb-12">
                {!online ? (
                    <div
                        style={{
                            padding: "10px 20px",
                            background: "var(--eduflow-warning-50)",
                            border: "1px solid var(--eduflow-warning-200)",
                            borderRadius: "var(--eduflow-radius-input)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: "var(--eduflow-warning-600)",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                            }}
                        >
                            <Icon name="warning" size={14} color="#fff" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: "var(--eduflow-warning-900)",
                                }}
                            >
                                Mode hors-ligne actif · réseau perdu
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-warning-800)",
                                }}
                            >
                                Les pages déjà chargées restent consultables. Les
                                fonctionnalités d'écriture seront mises en file dès que la file
                                IndexedDB sera activée.
                            </div>
                        </div>
                        <Badge variant="warning" icon="clock">
                            Pas de file pour l'instant
                        </Badge>
                    </div>
                ) : null}

                <PageHeader
                    title="Mode hors-ligne & PWA"
                    description={
                        online
                            ? `Connecté · dernière sync il y a ${minutesSinceSync} min`
                            : "Hors-ligne · données déjà chargées disponibles"
                    }
                    breadcrumbs={[
                        { label: "Système" },
                        { label: "Hors-ligne · PWA" },
                    ]}
                    actions={
                        installed ? (
                            <Badge variant="success" icon="check">
                                App installée
                            </Badge>
                        ) : installPrompt ? (
                            <Button
                                icon={installing ? undefined : "download"}
                                loading={installing}
                                onClick={handleInstall}
                            >
                                Installer EduPilot
                            </Button>
                        ) : (
                            <Badge variant="neutral">PWA · à installer depuis le navigateur</Badge>
                        )
                    }
                />

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1.6fr 1fr",
                        gap: 14,
                    }}
                    className="offline-grid"
                >
                    <Card padding={0}>
                        <div
                            style={{
                                padding: "12px 18px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <span style={{ fontSize: 13, fontWeight: 700 }}>
                                File d'attente locale · écritures en attente
                            </span>
                            <Badge variant="neutral" size="sm">
                                0 changement
                            </Badge>
                        </div>
                        <div
                            style={{
                                padding: "36px 18px",
                                textAlign: "center",
                                fontSize: 12,
                                color: "var(--eduflow-text-tertiary)",
                                lineHeight: 1.6,
                            }}
                        >
                            Aucune écriture en attente.
                            <br />
                            Lorsque la file IndexedDB sera activée, tes saisies hors-ligne (notes,
                            appel, mots de liaison) apparaîtront ici avec un badge « Local » jusqu'au
                            retour réseau.
                        </div>
                    </Card>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <Card>
                            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>État de la synchronisation</p>
                            <div
                                style={{
                                    marginTop: 10,
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    lineHeight: 1.8,
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <span>Réseau</span>
                                    <Badge
                                        variant={online ? "success" : "warning"}
                                        size="sm"
                                        dot
                                    >
                                        {online ? "En ligne" : "Hors-ligne"}
                                    </Badge>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <span>Dernière sync</span>
                                    <span
                                        className="eduflow-mono"
                                        style={{
                                            fontWeight: 600,
                                            fontFamily:
                                                "var(--font-mono, ui-monospace, monospace)",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {lastSync.toLocaleTimeString("fr-FR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        {" "}({minutesSinceSync} min)
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <span>File en attente</span>
                                    <span
                                        style={{
                                            color: "var(--eduflow-text-tertiary)",
                                            fontWeight: 700,
                                        }}
                                    >
                                        0
                                    </span>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <span>Espace utilisé</span>
                                    <span
                                        className="eduflow-mono"
                                        style={{
                                            fontWeight: 600,
                                            fontFamily:
                                                "var(--font-mono, ui-monospace, monospace)",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {fmtBytes(storage.used)} / {fmtBytes(storage.quota)}
                                    </span>
                                </div>
                            </div>
                            <div
                                style={{
                                    height: 6,
                                    background: "var(--eduflow-neutral-200)",
                                    borderRadius: 3,
                                    marginTop: 12,
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${storagePct}%`,
                                        background: "var(--brand-600)",
                                        transition:
                                            "width var(--motion-base, 280ms) var(--ease-out, ease)",
                                    }}
                                />
                            </div>
                        </Card>

                        <Card
                            style={{
                                background: "var(--brand-50)",
                                border: "1px solid var(--brand-200)",
                            }}
                        >
                            <div style={{ display: "flex", gap: 10 }}>
                                <Icon
                                    name="sparkle"
                                    size={18}
                                    color="var(--brand-700)"
                                    style={{ marginTop: 2 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: "var(--brand-900, var(--brand-800))",
                                        }}
                                    >
                                        PWA installable
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            margin: "4px 0 0",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        Installe EduPilot comme une vraie app : icône bureau,
                                        lancement instantané, fonctionne sans wifi pour la lecture.
                                        Pas besoin de Play Store.
                                    </p>
                                    {installed ? (
                                        <Badge
                                            variant="success"
                                            icon="check"
                                            size="sm"
                                        >
                                            App installée
                                        </Badge>
                                    ) : installPrompt ? (
                                        <Button
                                            size="sm"
                                            style={{ marginTop: 10 }}
                                            icon={installing ? undefined : "download"}
                                            loading={installing}
                                            onClick={handleInstall}
                                        >
                                            Installer EduPilot
                                        </Button>
                                    ) : (
                                        <p
                                            style={{
                                                fontSize: 11,
                                                color: "var(--brand-700)",
                                                marginTop: 10,
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            Sur Chrome / Edge desktop, regarde la barre d'adresse.
                                            Sur Android, ouvre le menu ⋮ → « Installer l'app ». Sur
                                            iOS Safari, partage → « Sur l'écran d'accueil ».
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>Fonctionnalités offline-first</p>
                            <div
                                style={{
                                    marginTop: 8,
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                }}
                            >
                                {OFFLINE_FEATURES.map((f) => (
                                    <div
                                        key={f.label}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <Icon
                                            name={f.supported ? "check" : "x"}
                                            size={12}
                                            color={
                                                f.supported
                                                    ? "var(--eduflow-success-600)"
                                                    : "var(--eduflow-text-tertiary)"
                                            }
                                        />
                                        <span
                                            style={{
                                                color: f.supported
                                                    ? "var(--eduflow-text-primary)"
                                                    : "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {f.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <p
                                style={{
                                    fontSize: 10,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginTop: 12,
                                    lineHeight: 1.5,
                                }}
                            >
                                Les fonctionnalités d'écriture seront supportées dès l'activation du
                                service worker + file IndexedDB. Les pages déjà chargées restent
                                consultables immédiatement.
                            </p>
                        </Card>
                    </div>
                </div>
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .offline-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
