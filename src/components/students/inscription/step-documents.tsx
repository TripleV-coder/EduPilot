"use client";

import { Badge, Icon, type IconName } from "@/components/edu";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export function StepDocuments() {
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Documents requis
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Liste des pièces justificatives à fournir pour le dossier MEMP.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                    { icon: "cards" as IconName, label: "Acte de naissance", note: "PDF ou scan original" },
                    {
                        icon: "cards" as IconName,
                        label: "Bulletin du dernier niveau validé",
                        note: "T1 + T2 + T3 ou semestre 1 + 2",
                    },
                    {
                        icon: "cards" as IconName,
                        label: "Certificat de scolarité précédent",
                        note: "École d'origine",
                    },
                    {
                        icon: "cards" as IconName,
                        label: "Photo d'identité de l'élève",
                        note: "Récente · format passeport",
                    },
                    {
                        icon: "cards" as IconName,
                        label: "Pièce d'identité du responsable",
                        note: "CNI ou passeport",
                    },
                ].map((d) => (
                    <div
                        key={d.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: 14,
                            border: "1px solid var(--eduflow-border-subtle)",
                            borderRadius: 12,
                            gap: 12,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: "var(--brand-50)",
                                    display: "grid",
                                    placeItems: "center",
                                }}
                            >
                                <Icon name={d.icon} size={18} color="var(--brand-700)" />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 2,
                                    }}
                                >
                                    {d.note}
                                </div>
                            </div>
                        </div>
                        <Badge variant="neutral" size="sm">
                            À téléverser
                        </Badge>
                    </div>
                ))}
            </div>
            <div
                style={{
                    marginTop: 18,
                    padding: 14,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    borderLeft: "3px solid var(--brand-500)",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                }}
            >
                <Icon name="info" size={18} color="var(--brand-700)" />
                <div
                    style={{
                        fontSize: 12,
                        color: "var(--eduflow-text-secondary)",
                        lineHeight: 1.55,
                    }}
                >
                    Les pièces seront téléversées depuis la fiche élève après finalisation. Tu pourras
                    aussi remettre des copies papier au secrétariat.
                </div>
            </div>
        </>
    );
}
