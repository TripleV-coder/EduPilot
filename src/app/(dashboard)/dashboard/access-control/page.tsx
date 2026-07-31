"use client";

import { useCallback, useEffect, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Permission } from "@/lib/rbac/permissions";
import { ScanPointCreateDialog } from "@/components/access-control/scan-point-create-dialog";
import { BadgeRegenerateDialog } from "@/components/access-control/badge-regenerate-dialog";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Logo,
    MetricCard,
    Spinner,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

type PreviewStudent = {
    firstName: string;
    lastName: string;
    matricule: string;
    className: string;
    schoolName: string;
    validUntil: string;
} | null;

type ScanLogEntry = {
    id: string;
    time: string;
    name: string;
    klass: string;
    point: string;
    action: string;
    variant: "success" | "info" | "warning" | "danger" | "brand";
    refused?: boolean;
};

const FALLBACK_MATRICULE = "BJ-2026-A0142";

export default function AccessControlPage() {
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState<PreviewStudent>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
        // Try to fetch one real student to power the badge preview. Falls back
        // to a generic placeholder when the call fails or returns nothing.
        const load = async () => {
            let matricule = FALLBACK_MATRICULE;
            try {
                const res = await fetch("/api/students?limit=1");
                if (res.ok) {
                    const d = await res.json();
                    const list = Array.isArray(d) ? d : d.data || d.students || [];
                    const s = list[0];
                    if (s?.user) {
                        matricule = s.matricule ?? FALLBACK_MATRICULE;
                        setPreview({
                            firstName: s.user.firstName,
                            lastName: s.user.lastName,
                            matricule,
                            className:
                                s.enrollments?.[0]?.class?.name ?? "Classe à confirmer",
                            schoolName: s.user.school?.name ?? "EduPilot School",
                            validUntil: "30 juin 2026",
                        });
                    }
                }
            } catch {
                /* ignore */
            } finally {
                setLoading(false);
            }

            // Génère un vrai QR scannable encodant le matricule du badge.
            try {
                const QRCode = (await import("qrcode")).default;
                const url = await QRCode.toDataURL(`EDUPILOT:STUDENT:${matricule}`, {
                    margin: 0,
                    width: 128,
                    errorCorrectionLevel: "M",
                });
                setQrDataUrl(url);
            } catch {
                /* le badge reste lisible sans QR si la génération échoue */
            }
        };
        load();
    }, []);

    const [liveLog, setLiveLog] = useState<ScanLogEntry[]>([]);
    const [metrics, setMetrics] = useState<{ todayTotal: number; todayRefused: number; todayOk: number } | null>(null);
    const [scanPoints, setScanPoints] = useState<Array<{ id: string; name: string; type: string; location: string | null; isActive: boolean }>>([]);

    const loadLogs = useCallback(async () => {
        try {
            const res = await fetch("/api/access-control/logs", { credentials: "include", cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setMetrics(data.metrics ?? null);
            setLiveLog(
                (data.logs ?? []).map((l: { id: string; time: string; name: string; matricule: string | null; point: string; action: string; refused: boolean }) => ({
                    id: l.id,
                    time: new Date(l.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
                    name: l.name,
                    klass: l.matricule ?? "—",
                    point: l.point,
                    action: l.action === "EXIT" ? "Sortie" : "Entrée",
                    variant: l.refused ? "danger" : "success",
                    refused: l.refused,
                }))
            );
        } catch {
            /* journal indisponible : on garde l'état courant */
        }
    }, []);

    const loadScanPoints = useCallback(async () => {
        try {
            const res = await fetch("/api/access-control/scan-points", { credentials: "include", cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setScanPoints(data.scanPoints ?? []);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        loadLogs();
        loadScanPoints();
    }, [loadLogs, loadScanPoints]);

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}
        >
            <PageShell className="pb-12">
                <PageHeader
                    title="QR Badge & contrôle d'accès"
                    description={`${scanPoints.length} point${scanPoints.length > 1 ? "s" : ""} de scan · ${metrics?.todayTotal ?? 0} passages aujourd'hui`}
                    breadcrumbs={[
                        { label: "Vie scolaire" },
                        { label: "Contrôle d'accès" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}>
                            <BadgeRegenerateDialog />
                            <ScanPointCreateDialog onCreated={loadScanPoints} />
                        </RoleActionGuard>
                    }
                />

                <Card padding={0}>
                    <div
                        style={{
                            padding: "12px 18px",
                            borderBottom: scanPoints.length > 0 ? "1px solid var(--eduflow-border-subtle)" : 0,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <h3 className="eduflow-display" style={{ fontSize: 15, margin: 0 }}>Points de scan</h3>
                        <Badge variant={scanPoints.some((p) => p.isActive) ? "success" : "neutral"} size="sm">
                            {scanPoints.filter((p) => p.isActive).length} actif{scanPoints.filter((p) => p.isActive).length > 1 ? "s" : ""}
                        </Badge>
                    </div>
                    {scanPoints.length === 0 ? (
                        <div style={{ padding: "24px 18px", fontSize: 12, color: "var(--eduflow-text-tertiary)", textAlign: "center" }}>
                            Aucun point de scan. Crée-en un (portail, cantine, transport…) pour démarrer la journalisation.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 18px" }}>
                            {scanPoints.map((p) => (
                                <div
                                    key={p.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 12px",
                                        borderRadius: 999,
                                        border: "1px solid var(--eduflow-border-subtle)",
                                        fontSize: 12,
                                        opacity: p.isActive ? 1 : 0.5,
                                    }}
                                >
                                    <Icon name="check" size={12} color="var(--eduflow-success-600)" />
                                    <strong>{p.name}</strong>
                                    <span style={{ color: "var(--eduflow-text-tertiary)" }}>{p.type}{p.location ? ` · ${p.location}` : ""}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: 12,
                    }}
                    className="kpi-grid"
                >
                    <MetricCard
                        label="Passages aujourd'hui"
                        value={metrics ? String(metrics.todayTotal) : "—"}
                        icon="users"
                        variant="neutral"
                    />
                    <MetricCard
                        label="Accès validés"
                        value={metrics ? String(metrics.todayOk) : "—"}
                        icon="check"
                        variant={metrics && metrics.todayOk > 0 ? "success" : "neutral"}
                    />
                    <MetricCard
                        label="Refusés"
                        value={metrics ? String(metrics.todayRefused) : "—"}
                        icon="warning"
                        variant={metrics && metrics.todayRefused > 0 ? "danger" : "neutral"}
                    />
                    <MetricCard
                        label="Points de scan"
                        value={String(scanPoints.length)}
                        icon="cards"
                        variant="neutral"
                    />
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1.4fr",
                        gap: 14,
                    }}
                    className="qr-grid"
                >
                    <Card padding={20}>
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>
                            Aperçu badge ·{" "}
                            {preview
                                ? `${preview.firstName} ${preview.lastName.toUpperCase()}`
                                : "exemple"}
                        </p>
                        {loading ? (
                            <div
                                style={{
                                    marginTop: 14,
                                    padding: 36,
                                    textAlign: "center",
                                }}
                            >
                                <Spinner size={20} color="var(--brand-600)" />
                            </div>
                        ) : (
                            <div
                                style={{
                                    marginTop: 14,
                                    padding: 18,
                                    background:
                                        "linear-gradient(160deg, var(--brand-800, var(--brand-700)), var(--accent-600, #4F46E5))",
                                    borderRadius: 20,
                                    color: "#fff",
                                    position: "relative",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        position: "absolute",
                                        top: -20,
                                        right: -20,
                                        width: 100,
                                        height: 100,
                                        borderRadius: "50%",
                                        background: "rgba(255,255,255,0.08)",
                                    }}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        opacity: 0.85,
                                    }}
                                >
                                    <Logo size={18} />
                                    {preview?.schoolName ?? "EduPilot School"}
                                </div>
                                <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                                    <Avatar
                                        name={
                                            preview
                                                ? `${preview.firstName} ${preview.lastName}`
                                                : "Aïcha Hounsou"
                                        }
                                        size="lg"
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                fontSize: 10,
                                                opacity: 0.75,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            Élève · {preview?.className ?? "3ᵉ A"}
                                        </div>
                                        <div
                                            className="eduflow-display"
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                                lineHeight: 1.1,
                                                marginTop: 4,
                                            }}
                                        >
                                            {preview ? (
                                                <>
                                                    {preview.firstName}
                                                    <br />
                                                    {preview.lastName.toUpperCase()}
                                                </>
                                            ) : (
                                                <>
                                                    Aïcha
                                                    <br />
                                                    HOUNSOU
                                                </>
                                            )}
                                        </div>
                                        <div
                                            className="eduflow-mono"
                                            style={{
                                                fontSize: 11,
                                                opacity: 0.85,
                                                marginTop: 6,
                                                fontFamily:
                                                    "var(--font-mono, ui-monospace, monospace)",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {preview?.matricule ?? "BJ-2026-A0142"}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        marginTop: 14,
                                        padding: 10,
                                        background: "#fff",
                                        borderRadius: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                    }}
                                >
                                    {/* QR réel encodant le matricule du badge. */}
                                    {qrDataUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={qrDataUrl}
                                            alt={`QR badge ${preview?.matricule ?? FALLBACK_MATRICULE}`}
                                            width={64}
                                            height={64}
                                            style={{ width: 64, height: 64, borderRadius: 6, flexShrink: 0 }}
                                        />
                                    ) : (
                                        <div
                                            aria-hidden="true"
                                            style={{
                                                width: 64,
                                                height: 64,
                                                borderRadius: 6,
                                                flexShrink: 0,
                                                background: "#f1f5f9",
                                            }}
                                        />
                                    )}
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: "#0F172A",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        <strong>Scan pour identification</strong>
                                        <br />
                                        Cantine · transport · accès école
                                        <br />
                                        <span
                                            className="eduflow-mono"
                                            style={{
                                                opacity: 0.6,
                                                fontFamily:
                                                    "var(--font-mono, ui-monospace, monospace)",
                                            }}
                                        >
                                            Valide jusqu'au {preview?.validUntil ?? "30 juin 2026"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="download"
                                disabled
                                style={{ flex: 1 }}
                            >
                                Imprimer
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="cards"
                                disabled
                                style={{ flex: 1 }}
                            >
                                Format mobile
                            </Button>
                        </div>
                    </Card>

                    <Card padding={0}>
                        <div
                            style={{
                                padding: "14px 18px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderBottom: "1px solid var(--eduflow-border-subtle)",
                            }}
                        >
                            <div>
                                <h3
                                    className="eduflow-display"
                                    style={{ fontSize: 16, margin: 0 }}
                                >
                                    Passages en direct
                                </h3>
                                <p
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        margin: "2px 0 0",
                                    }}
                                >
                                    50 derniers passages enregistrés aux points de scan.
                                </p>
                            </div>
                            <Badge variant={scanPoints.some((p) => p.isActive) ? "success" : "neutral"} size="sm">
                                {scanPoints.some((p) => p.isActive) ? "Actif" : "Inactif"}
                            </Badge>
                        </div>
                        {liveLog.length === 0 ? (
                            <div
                                style={{
                                    padding: "48px 18px",
                                    textAlign: "center",
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                    lineHeight: 1.7,
                                }}
                            >
                                Aucun passage enregistré.
                                <br />
                                Configure un point de scan (cantine, portail, transport,
                                bibliothèque, infirmerie) pour démarrer la journalisation.
                            </div>
                        ) : (
                            liveLog.map((s, i) => (
                                <div
                                    key={s.id}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "50px 1fr auto",
                                        gap: 12,
                                        padding: "12px 18px",
                                        borderTop:
                                            i > 0
                                                ? "1px solid var(--eduflow-border-subtle)"
                                                : 0,
                                        alignItems: "center",
                                        background:
                                            s.variant === "danger"
                                                ? "var(--eduflow-danger-50)"
                                                : "transparent",
                                    }}
                                >
                                    <span
                                        className="eduflow-mono"
                                        style={{
                                            fontSize: 11,
                                            color: "var(--eduflow-text-tertiary)",
                                            fontFamily:
                                                "var(--font-mono, ui-monospace, monospace)",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {s.time}
                                    </span>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {s.name}{" "}
                                            <span
                                                style={{
                                                    color:
                                                        "var(--eduflow-text-tertiary)",
                                                    fontWeight: 400,
                                                }}
                                            >
                                                · {s.klass}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color:
                                                    "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {s.point} · {s.action}
                                        </div>
                                    </div>
                                    <Badge
                                        variant={s.variant}
                                        size="sm"
                                        dot={s.refused}
                                    >
                                        {s.refused ? "Refusé" : "OK"}
                                    </Badge>
                                </div>
                            ))
                        )}
                    </Card>
                </div>
            </PageShell>

            <style jsx global>{`
                @media (max-width: 960px) {
                    .kpi-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .qr-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}
