import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import prisma from "@/lib/prisma";
import { PublicHeader } from "@/components/public/public-header";
import { schoolTypeLabel, schoolLevelLabel } from "@/components/public/labels";

const BAND_COLOR: Record<string, string> = {
    brand: "var(--eduflow-brand-700)",
    success: "var(--eduflow-success-700)",
    warning: "var(--eduflow-warning-600)",
    danger: "var(--eduflow-danger-700)",
    accent: "var(--eduflow-accent-600)",
};

/** Récupère la fiche publique (mémoïsée par requête pour métadonnées + rendu). */
const getSchool = cache(async (code: string) => {
    return prisma.school.findFirst({
        where: { code, isPublic: true, isActive: true },
        select: {
            name: true,
            code: true,
            logo: true,
            coverImage: true,
            motto: true,
            publicDescription: true,
            city: true,
            region: true,
            type: true,
            offeredLevels: true,
            primaryColor: true,
            email: true,
            publicPhone: true,
        },
    });
});

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string }>;
}): Promise<Metadata> {
    const { code } = await params;
    const school = await getSchool(code);
    if (!school) return { title: "Établissement introuvable — EduPilot" };
    return {
        title: `${school.name} — EduPilot`,
        description: school.motto ?? school.publicDescription ?? `Fiche de l'établissement ${school.name}.`,
    };
}

export default async function SchoolPublicPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const school = await getSchool(code);
    if (!school) notFound();

    const band = BAND_COLOR[school.primaryColor ?? "brand"] ?? BAND_COLOR.brand;
    const location = [school.city, school.region].filter(Boolean).join(" · ");

    return (
        <div style={{ minHeight: "100vh", background: "var(--eduflow-surface-sunken)" }}>
            <PublicHeader />

            {/* Bannière */}
            <div style={{ height: 200, background: band, position: "relative", overflow: "hidden" }}>
                {school.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={school.coverImage}
                        alt={`Bannière de l'établissement ${school.name}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                ) : null}
            </div>

            <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px 60px" }}>
                {/* En-tête établissement */}
                <div className="flex items-end gap-4" style={{ marginTop: -44 }}>
                    <div
                        className="grid place-items-center"
                        style={{
                            width: 88,
                            height: 88,
                            borderRadius: 18,
                            background: "#fff",
                            border: "1px solid var(--eduflow-border-subtle)",
                            boxShadow: "var(--eduflow-shadow-sm)",
                            overflow: "hidden",
                            flexShrink: 0,
                        }}
                    >
                        {school.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={school.logo}
                                alt={`Logo de ${school.name}`}
                                style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }}
                            />
                        ) : (
                            <span style={{ fontSize: 34, fontWeight: 800, color: "var(--brand-700)" }}>
                                {school.name.charAt(0)}
                            </span>
                        )}
                    </div>
                    <div style={{ paddingBottom: 6 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>{school.name}</h1>
                        {location ? (
                            <div style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)", marginTop: 2 }}>{location}</div>
                        ) : null}
                    </div>
                </div>

                {school.motto ? (
                    <p style={{ marginTop: 18, fontSize: 17, fontStyle: "italic", color: "var(--eduflow-text-secondary)" }}>
                        « {school.motto} »
                    </p>
                ) : null}

                {/* Badges type + cycles */}
                <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
                    {school.type ? <Tag>{schoolTypeLabel(school.type)}</Tag> : null}
                    {school.offeredLevels.map((lvl) => (
                        <Tag key={lvl}>{schoolLevelLabel(lvl)}</Tag>
                    ))}
                </div>

                {school.publicDescription ? (
                    <p style={{ marginTop: 24, fontSize: 15, lineHeight: 1.7, color: "var(--eduflow-text-primary)", whiteSpace: "pre-line" }}>
                        {school.publicDescription}
                    </p>
                ) : null}

                {/* Contact */}
                <div
                    style={{
                        marginTop: 28,
                        padding: 20,
                        borderRadius: 14,
                        border: "1px solid var(--eduflow-border-subtle)",
                        background: "var(--eduflow-surface-card)",
                    }}
                >
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Contact & pré-inscription</h2>
                    {school.email || school.publicPhone ? (
                        <div className="flex flex-wrap gap-2">
                            {school.email ? (
                                <a href={`mailto:${school.email}`} style={ctaPrimary}>
                                    Écrire à l&apos;établissement
                                </a>
                            ) : null}
                            {school.publicPhone ? (
                                <a href={`tel:${school.publicPhone}`} style={ctaSecondary}>
                                    {school.publicPhone}
                                </a>
                            ) : null}
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>
                            Coordonnées non communiquées.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 999,
                background: "var(--brand-50)",
                color: "var(--brand-700)",
            }}
        >
            {children}
        </span>
    );
}

const ctaPrimary: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 10,
    background: "var(--brand-700)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
};
const ctaSecondary: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--eduflow-border-default)",
    color: "var(--eduflow-text-primary)",
    fontSize: 14,
    fontWeight: 600,
};
