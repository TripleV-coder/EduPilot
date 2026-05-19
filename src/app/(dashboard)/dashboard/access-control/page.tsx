"use client";

import { useEffect, useState } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

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
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

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

export default function AccessControlPage() {
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState<PreviewStudent>(null);

    useEffect(() => {
        // Try to fetch one real student to power the badge preview. Falls back
        // to a generic placeholder when the call fails or returns nothing.
        const load = async () => {
            try {
                const res = await fetch("/api/students?limit=1");
                if (res.ok) {
                    const d = await res.json();
                    const list = Array.isArray(d) ? d : d.data || d.students || [];
                    const s = list[0];
                    if (s?.user) {
                        setPreview({
                            firstName: s.user.firstName,
                            lastName: s.user.lastName,
                            matricule: s.matricule,
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
        };
        load();
    }, []);

    const liveLog: ScanLogEntry[] = []; // Empty until a ScanLog model exists

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "STAFF"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="QR Badge & contrôle d'accès"
                    sub="Module à configurer · génération badges, points de scan, journal en direct"
                    breadcrumb={["Vie scolaire", "Contrôle accès"]}
                    actions={
                        <>
                            <Button variant="secondary" icon="download" disabled>
                                Régénérer badges classe
                            </Button>
                            <Button icon="plus" disabled>
                                Nouveau point de scan
                            </Button>
                        </>
                    }
                />

                <Card
                    padding={20}
                    style={{
                        background: "var(--brand-50)",
                        border: "1px solid var(--brand-200)",
                    }}
                >
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <Icon
                            name="info"
                            size={20}
                            color="var(--brand-700)"
                            style={{ marginTop: 2, flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                className="eduflow-display"
                                style={{
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: "var(--brand-900, var(--brand-800))",
                                }}
                            >
                                Module en préparation
                            </div>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--brand-800)",
                                    margin: "4px 0 0",
                                    lineHeight: 1.6,
                                }}
                            >
                                Le badge unique par élève (avec QR signé) permettra le contrôle des
                                entrées/sorties, l'identification cantine et le pointage transport.
                                Les modèles Prisma <code>AccessPoint</code> + <code>ScanLog</code> et
                                la génération QR ne sont pas encore branchés — l'aperçu ci-dessous
                                montre le rendu final attendu.
                            </p>
                        </div>
                    </div>
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
                        label="Passages · matin"
                        value="—"
                        icon="users"
                        variant="neutral"
                    />
                    <MetricCard
                        label="Retards entrée"
                        value="—"
                        icon="warning"
                        variant="neutral"
                    />
                    <MetricCard
                        label="Repas cantine"
                        value="—"
                        icon="cards"
                        variant="neutral"
                    />
                    <MetricCard
                        label="Sorties non autorisées"
                        value="—"
                        icon="check"
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
                        <SubLabel>
                            Aperçu badge ·{" "}
                            {preview
                                ? `${preview.firstName} ${preview.lastName.toUpperCase()}`
                                : "exemple"}
                        </SubLabel>
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
                                    {/* Faux QR — repeating-conic visual placeholder */}
                                    <div
                                        style={{
                                            width: 64,
                                            height: 64,
                                            background:
                                                "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50%/8px 8px",
                                            borderRadius: 6,
                                            boxShadow: "inset 0 0 0 3px #fff",
                                            flexShrink: 0,
                                        }}
                                    />
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
                                    Le journal en temps réel apparaîtra ici dès que les points de
                                    scan seront configurés.
                                </p>
                            </div>
                            <Badge variant="neutral" size="sm">
                                Inactif
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
            </div>

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
