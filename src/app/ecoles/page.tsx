"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PublicHeader } from "@/components/public/public-header";
import { SCHOOL_TYPE_LABELS, SCHOOL_LEVEL_LABELS, schoolTypeLabel } from "@/components/public/labels";

interface SchoolCard {
    id: string;
    code: string;
    name: string;
    logo: string | null;
    coverImage: string | null;
    motto: string | null;
    city: string | null;
    region: string | null;
    type: string | null;
    offeredLevels: string[];
}
interface DirectoryResponse {
    page: number;
    totalPages: number;
    total: number;
    regions: string[];
    schools: SchoolCard[];
}

const inputStyle: React.CSSProperties = {
    height: 40,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--eduflow-border-default)",
    background: "var(--eduflow-surface-card)",
    fontFamily: "inherit",
    fontSize: 13,
    color: "var(--eduflow-text-primary)",
};

function DirectoryInner() {
    const [q, setQ] = useState("");
    const [region, setRegion] = useState("");
    const [type, setType] = useState("");
    const [level, setLevel] = useState("");
    const [page, setPage] = useState(1);

    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (region) params.set("region", region);
    if (type) params.set("type", type);
    if (level) params.set("level", level);
    params.set("page", String(page));

    const { data, isLoading, error } = useSWR<DirectoryResponse>(
        `/api/public/schools?${params.toString()}`,
        fetcher,
        { keepPreviousData: true },
    );

    const resetPageThen = (fn: () => void) => {
        setPage(1);
        fn();
    };

    return (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px" }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
                Annuaire des établissements
            </h1>
            <p style={{ margin: "0 0 22px", color: "var(--eduflow-text-secondary)", fontSize: 15 }}>
                Découvre les écoles qui utilisent EduPilot.
            </p>

            {/* Filtres */}
            <div className="flex flex-wrap gap-2" style={{ marginBottom: 22 }}>
                <input
                    type="search"
                    value={q}
                    onChange={(e) => resetPageThen(() => setQ(e.target.value))}
                    placeholder="Rechercher une école…"
                    style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                    aria-label="Rechercher une école"
                />
                <select value={region} onChange={(e) => resetPageThen(() => setRegion(e.target.value))} style={inputStyle} aria-label="Région">
                    <option value="">Toutes les régions</option>
                    {(data?.regions ?? []).map((r) => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
                <select value={type} onChange={(e) => resetPageThen(() => setType(e.target.value))} style={inputStyle} aria-label="Type">
                    <option value="">Tous les types</option>
                    {Object.entries(SCHOOL_TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
                <select value={level} onChange={(e) => resetPageThen(() => setLevel(e.target.value))} style={inputStyle} aria-label="Cycle">
                    <option value="">Tous les cycles</option>
                    {Object.entries(SCHOOL_LEVEL_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
            </div>

            {error ? (
                <p style={{ color: "var(--eduflow-danger-600)" }}>Impossible de charger l&apos;annuaire.</p>
            ) : isLoading && !data ? (
                <p style={{ color: "var(--eduflow-text-tertiary)" }}>Chargement…</p>
            ) : data && data.schools.length === 0 ? (
                <p style={{ color: "var(--eduflow-text-tertiary)" }}>Aucun établissement ne correspond à ta recherche.</p>
            ) : (
                <>
                    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                        {data?.schools.map((s) => (
                            <Link
                                key={s.id}
                                href={`/ecole/${s.code}`}
                                className="block transition-shadow hover:shadow-md"
                                style={{
                                    borderRadius: 14,
                                    overflow: "hidden",
                                    border: "1px solid var(--eduflow-border-subtle)",
                                    background: "var(--eduflow-surface-card)",
                                }}
                            >
                                <div style={{ height: 96, background: "var(--brand-50)", position: "relative" }}>
                                    {s.coverImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={s.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : null}
                                </div>
                                <div style={{ padding: 16 }}>
                                    <div className="flex items-center gap-2">
                                        {s.logo ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={s.logo} alt="" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
                                        ) : null}
                                        <span style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</span>
                                    </div>
                                    {s.motto ? (
                                        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--eduflow-text-secondary)", lineHeight: 1.4 }}>
                                            {s.motto}
                                        </p>
                                    ) : null}
                                    <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--eduflow-text-tertiary)" }}>
                                        {[s.city, s.region].filter(Boolean).join(" · ")}
                                        {s.type ? ` · ${schoolTypeLabel(s.type)}` : ""}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Pagination */}
                    {data && data.totalPages > 1 ? (
                        <div className="flex items-center justify-center gap-3" style={{ marginTop: 28 }}>
                            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerBtn}>
                                Précédent
                            </button>
                            <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                                Page {data.page} / {data.totalPages}
                            </span>
                            <button type="button" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} style={pagerBtn}>
                                Suivant
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}

const pagerBtn: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--eduflow-border-default)",
    background: "var(--eduflow-surface-card)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
};

export default function EcolesDirectoryPage() {
    return (
        <div style={{ minHeight: "100vh", background: "var(--eduflow-surface-sunken)" }}>
            <PublicHeader />
            <Suspense fallback={null}>
                <DirectoryInner />
            </Suspense>
        </div>
    );
}
