"use client";

import type { StudentCardData } from "@/lib/students/student-card";

export type StudentCardView = StudentCardData & { qrDataUrl: string };

/** Couleur de bandeau selon la couleur primaire de l'école. */
const BAND_COLOR: Record<string, string> = {
    brand: "var(--eduflow-brand-700)",
    success: "var(--eduflow-success-700)",
    warning: "var(--eduflow-warning-600)",
    danger: "var(--eduflow-danger-700)",
    accent: "var(--eduflow-accent-600)",
};

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Carte scolaire élève au format CR80 (85,6 × 54 mm), optimisée pour l'impression.
 * Recto : identité école, photo, informations élève, QR (badge ou matricule).
 */
export function StudentIdCard({ card }: { card: StudentCardView }) {
    const band = BAND_COLOR[card.school.primaryColor] ?? BAND_COLOR.brand;

    return (
        <div
            className="student-card"
            style={{
                width: "85.6mm",
                height: "54mm",
                borderRadius: "3mm",
                overflow: "hidden",
                background: "#fff",
                color: "#111",
                border: "1px solid #d4d4d4",
                display: "flex",
                flexDirection: "column",
                fontFamily: "var(--font-sans, system-ui, sans-serif)",
                breakInside: "avoid",
            }}
        >
            {/* Bandeau école */}
            <div
                style={{
                    background: band,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    gap: "2mm",
                    padding: "1.6mm 3mm",
                }}
            >
                {card.school.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={card.school.logo}
                        alt=""
                        style={{ width: "6mm", height: "6mm", objectFit: "contain", background: "#fff", borderRadius: "1mm", padding: "0.4mm" }}
                    />
                ) : null}
                <span style={{ fontSize: "3mm", fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1.1 }}>
                    {card.school.name}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "2.2mm", fontWeight: 600, opacity: 0.85 }}>
                    CARTE SCOLAIRE
                </span>
            </div>

            {/* Corps */}
            <div style={{ display: "flex", flex: 1, gap: "3mm", padding: "2.5mm 3mm" }}>
                {/* Photo */}
                <div
                    style={{
                        width: "20mm",
                        height: "26mm",
                        flexShrink: 0,
                        borderRadius: "1.5mm",
                        overflow: "hidden",
                        background: "#f0f0f0",
                        border: "0.3mm solid #ccc",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {card.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                        <span style={{ fontSize: "6mm", fontWeight: 700, color: "#999" }}>
                            {card.fullName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>

                {/* Détails */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <div style={{ fontSize: "3.6mm", fontWeight: 800, lineHeight: 1.1, marginBottom: "1mm" }}>
                        {card.fullName}
                    </div>
                    <Row label="Matricule" value={card.matricule} mono />
                    <Row label="Classe" value={card.className} />
                    <Row label="Année" value={card.academicYearLabel} />
                    <Row label="Né(e) le" value={formatDate(card.dateOfBirth)} />
                </div>

                {/* QR */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.qrDataUrl} alt={`QR ${card.matricule}`} style={{ width: "16mm", height: "16mm" }} />
                </div>
            </div>
        </div>
    );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div style={{ display: "flex", gap: "1.5mm", fontSize: "2.6mm", lineHeight: 1.5 }}>
            <span style={{ color: "#666", minWidth: "16mm" }}>{label}</span>
            <span style={{ fontWeight: 600, fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>
                {value}
            </span>
        </div>
    );
}
