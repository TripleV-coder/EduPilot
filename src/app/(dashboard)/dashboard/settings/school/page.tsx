"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { useSchool } from "@/components/providers/school-provider";
import { Permission } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveStatus } from "@/components/edu";
import { Loader2, Check, Building2 } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { useAutoSave } from "@/hooks/use-autosave";

type PrimaryColor = "brand" | "success" | "warning" | "danger" | "accent";

type SchoolProfile = {
    id: string;
    name: string;
    code: string | null;
    motto: string | null;
    mempCode: string | null;
    emailDomain: string | null;
    email: string | null;
    logo: string | null;
    primaryColor: PrimaryColor | null;
    isPublic: boolean;
    coverImage: string | null;
    publicDescription: string | null;
    region: string | null;
    publicPhone: string | null;
};

const COLOR_SWATCHES: Array<{ key: PrimaryColor; label: string; swatch: string }> = [
    { key: "brand",   label: "Bleu",   swatch: "var(--eduflow-brand-700)" },
    { key: "success", label: "Vert",   swatch: "var(--eduflow-success-700)" },
    { key: "warning", label: "Ambre",  swatch: "var(--eduflow-warning-600)" },
    { key: "danger",  label: "Rouge",  swatch: "var(--eduflow-danger-700)" },
    { key: "accent",  label: "Indigo", swatch: "var(--eduflow-accent-600)" },
];

const EMPTY: SchoolProfile = {
    id: "", name: "", code: null, motto: null, mempCode: null,
    emailDomain: null, email: null, logo: null, primaryColor: "brand",
    isPublic: false, coverImage: null, publicDescription: null, region: null, publicPhone: null,
};

export default function SchoolIdentityPage() {
    const { schoolId } = useSchool();
    const { data: school, isLoading, mutate } = useSWR<SchoolProfile>(
        schoolId ? `/api/schools/${schoolId}` : null,
        fetcher,
    );

    const [form, setForm] = useState<SchoolProfile>(EMPTY);
    const [uploading, setUploading] = useState(false);
    // Passe à true une fois l'établissement chargé et le formulaire hydraté :
    // n'active l'auto-save qu'ensuite pour ne pas ré-enregistrer au chargement.
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (!school) return;
        setForm({
            id: school.id,
            name: school.name ?? "",
            code: school.code ?? "",
            motto: school.motto ?? "",
            mempCode: school.mempCode ?? "",
            emailDomain: school.emailDomain ?? "",
            email: school.email ?? "",
            logo: school.logo ?? "",
            primaryColor: (school.primaryColor as PrimaryColor) ?? "brand",
            isPublic: school.isPublic ?? false,
            coverImage: school.coverImage ?? "",
            publicDescription: school.publicDescription ?? "",
            region: school.region ?? "",
            publicPhone: school.publicPhone ?? "",
        });
        setHydrated(true);
    }, [school]);

    const dirty = !!school && (
        form.name !== (school.name ?? "") ||
        form.code !== (school.code ?? "") ||
        form.motto !== (school.motto ?? "") ||
        form.mempCode !== (school.mempCode ?? "") ||
        form.emailDomain !== (school.emailDomain ?? "") ||
        form.logo !== (school.logo ?? "") ||
        form.primaryColor !== ((school.primaryColor as PrimaryColor) ?? "brand") ||
        form.isPublic !== (school.isPublic ?? false) ||
        form.coverImage !== (school.coverImage ?? "") ||
        form.publicDescription !== (school.publicDescription ?? "") ||
        form.region !== (school.region ?? "") ||
        form.publicPhone !== (school.publicPhone ?? "")
    );

    // Charge utile PATCH (idempotent) surveillée par l'auto-save.
    const payload = {
        name: form.name,
        motto: form.motto || null,
        mempCode: form.mempCode || null,
        emailDomain: form.emailDomain || null,
        logo: form.logo || null,
        primaryColor: form.primaryColor,
        isPublic: form.isPublic,
        coverImage: form.coverImage || null,
        publicDescription: form.publicDescription || null,
        region: form.region || null,
        publicPhone: form.publicPhone || null,
    };

    const {
        status: saveStatus,
        lastSavedAt,
        error: saveError,
        isOnline,
        saveNow,
    } = useAutoSave({
        data: payload,
        enabled: hydrated && !!schoolId,
        // Le nom officiel est requis (min. 3 caractères) : on bloque l'envoi sinon.
        validate: (d) => (d.name ?? "").trim().length >= 3,
        onSave: async (d) => {
            const res = await fetch(`/api/schools/${schoolId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(d),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Échec de l'enregistrement");
            }
            await mutate();
        },
    });

    const saving = saveStatus === "saving";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveNow();
    };

    const handleCancel = () => {
        if (school) {
            setForm({
                id: school.id,
                name: school.name ?? "",
                code: school.code ?? "",
                motto: school.motto ?? "",
                mempCode: school.mempCode ?? "",
                emailDomain: school.emailDomain ?? "",
                email: school.email ?? "",
                logo: school.logo ?? "",
                primaryColor: (school.primaryColor as PrimaryColor) ?? "brand",
                isPublic: school.isPublic ?? false,
                coverImage: school.coverImage ?? "",
                publicDescription: school.publicDescription ?? "",
                region: school.region ?? "",
                publicPhone: school.publicPhone ?? "",
            });
        }
    };

    const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("type", "school-cover");
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            if (!res.ok) throw new Error("Upload refusé");
            const data = await res.json();
            const url = data?.url ?? data?.data?.url;
            if (!url) throw new Error("URL absente de la réponse");
            setForm((f) => ({ ...f, coverImage: url }));
            toast.success("Image de couverture téléversée.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur d'upload");
        } finally {
            setUploading(false);
        }
    };

    const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("type", "school-logo");
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            if (!res.ok) throw new Error("Upload refusé");
            const data = await res.json();
            const url = data?.url ?? data?.data?.url;
            if (!url) throw new Error("URL absente de la réponse");
            setForm((f) => ({ ...f, logo: url }));
            toast.success("Logo téléversé.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur d'upload");
        } finally {
            setUploading(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_UPDATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="space-y-4 max-w-[1280px] mx-auto pb-12">
                <PageHeader
                    title="Paramètres"
                    description="Configuration de l'établissement, branding, conformité"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres", href: "/dashboard/settings" },
                    ]}
                />

                <div className="grid gap-3.5" style={{ gridTemplateColumns: "240px 1fr" }}>
                    <SettingsSidebar />

                    <form
                        onSubmit={handleSubmit}
                        className="rounded-xl"
                        style={{
                            background: "var(--eduflow-surface-card)",
                            border: "1px solid var(--eduflow-border-subtle)",
                            padding: 28,
                        }}
                    >
                        <h2
                            className="m-0"
                            style={{
                                fontSize: 20,
                                fontWeight: 700,
                                letterSpacing: "-0.02em",
                                marginBottom: 22,
                            }}
                        >
                            Identité & branding
                        </h2>

                        {isLoading ? (
                            <div className="py-16 text-center" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-8" style={{ gridTemplateColumns: "1fr 320px", marginBottom: 24 }}>
                                    <div className="flex flex-col gap-3.5">
                                        <Field label="Nom officiel" required>
                                            <Input
                                                type="text"
                                                value={form.name}
                                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                                required
                                                minLength={3}
                                            />
                                        </Field>
                                        <Field label="Sigle" hint="Code court unique · non modifiable ici">
                                            <Input
                                                type="text"
                                                value={form.code ?? ""}
                                                readOnly
                                                className="opacity-70 cursor-not-allowed"
                                            />
                                        </Field>
                                        <Field label="Devise / slogan">
                                            <Input
                                                type="text"
                                                value={form.motto ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))}
                                                maxLength={140}
                                                placeholder="Ex : L'excellence éducative au cœur du Bénin"
                                            />
                                        </Field>
                                        <Field label="Code MEMP">
                                            <Input
                                                type="text"
                                                value={form.mempCode ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, mempCode: e.target.value }))}
                                                maxLength={32}
                                                placeholder="Ex : BJ-COT-0142"
                                            />
                                        </Field>
                                        <Field label="Domaine email">
                                            <Input
                                                type="text"
                                                value={form.emailDomain ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, emailDomain: e.target.value }))}
                                                pattern="[a-z0-9.\-]+\.[a-z]{2,}"
                                                placeholder="Ex : cbe.bj"
                                            />
                                        </Field>
                                    </div>

                                    <div>
                                        <SubLabel>Logo · 256 × 256 minimum</SubLabel>
                                        <div
                                            className="rounded-xl text-center"
                                            style={{
                                                marginTop: 8,
                                                padding: 24,
                                                border: "2px dashed var(--eduflow-border-default)",
                                                background: "var(--eduflow-surface-sunken)",
                                            }}
                                        >
                                            <div className="grid place-items-center" style={{ width: 80, height: 80, margin: "0 auto" }}>
                                                {form.logo ? (
                                                    <Image
                                                        src={form.logo}
                                                        alt="Logo établissement"
                                                        width={80}
                                                        height={80}
                                                        className="rounded-xl object-contain"
                                                        style={{ background: "#fff", padding: 4 }}
                                                    />
                                                ) : (
                                                    <div
                                                        className="rounded-xl grid place-items-center"
                                                        style={{
                                                            width: 80,
                                                            height: 80,
                                                            background: "var(--eduflow-brand-100)",
                                                            color: "var(--eduflow-brand-800)",
                                                        }}
                                                    >
                                                        <Building2 className="w-9 h-9" />
                                                    </div>
                                                )}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                    marginTop: 12,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {form.logo ? form.logo.split("/").pop() : "Aucun logo téléversé"}
                                            </div>
                                            <div className="flex gap-1.5 justify-center mt-3">
                                                <label
                                                    className="inline-flex items-center gap-1 rounded-md cursor-pointer transition-colors"
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        padding: "6px 10px",
                                                        background: "var(--eduflow-surface-card)",
                                                        border: "1px solid var(--eduflow-border-default)",
                                                        color: "var(--eduflow-text-primary)",
                                                    }}
                                                >
                                                    {uploading
                                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                                        : "Remplacer"}
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        className="sr-only"
                                                        onChange={handleLogoFile}
                                                        disabled={uploading}
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setForm((f) => ({ ...f, logo: "" }))}
                                                    disabled={!form.logo}
                                                    className="rounded-md transition-colors"
                                                    style={{
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        padding: "6px 10px",
                                                        background: "transparent",
                                                        border: "1px solid transparent",
                                                        color: "var(--eduflow-text-tertiary)",
                                                        cursor: form.logo ? "pointer" : "not-allowed",
                                                    }}
                                                >
                                                    Supprimer
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <SubLabel>Couleur primaire · parents et élèves verront cette couleur</SubLabel>
                                <div className="flex gap-2.5 mt-2">
                                    {COLOR_SWATCHES.map((c) => {
                                        const active = form.primaryColor === c.key;
                                        return (
                                            <button
                                                key={c.key}
                                                type="button"
                                                onClick={() => setForm((f) => ({ ...f, primaryColor: c.key }))}
                                                aria-label={`Choisir la couleur ${c.label}`}
                                                aria-pressed={active}
                                                title={c.label}
                                                className="relative grid place-items-center"
                                                style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 12,
                                                    background: c.swatch,
                                                    border: active
                                                        ? "3px solid var(--eduflow-text-primary)"
                                                        : "1px solid var(--eduflow-border-default)",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {active && <Check className="w-4 h-4" style={{ color: "#fff" }} />}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--eduflow-border-subtle)" }}>
                                    <SubLabel>Vitrine publique · annuaire des écoles</SubLabel>

                                    <label className="flex items-start gap-3" style={{ marginTop: 12, cursor: "pointer" }}>
                                        <input
                                            type="checkbox"
                                            checked={form.isPublic}
                                            onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
                                            style={{ width: 18, height: 18, marginTop: 2 }}
                                        />
                                        <span>
                                            <span style={{ fontSize: 14, fontWeight: 600 }}>Publier la fiche publique</span>
                                            <span style={{ display: "block", fontSize: 12, color: "var(--eduflow-text-tertiary)" }}>
                                                Rend l&apos;établissement visible dans l&apos;annuaire public et sur sa fiche.
                                            </span>
                                        </span>
                                    </label>

                                    {form.isPublic && form.code ? (
                                        <a
                                            href={`/ecole/${form.code}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, color: "var(--brand-700)" }}
                                        >
                                            Voir la fiche publique ↗
                                        </a>
                                    ) : null}

                                    <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
                                        <Field label="Région / département">
                                            <Input type="text" value={form.region ?? ""} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} maxLength={120} placeholder="Ex : Littoral" />
                                        </Field>
                                        <Field label="Téléphone public">
                                            <Input type="text" value={form.publicPhone ?? ""} onChange={(e) => setForm((f) => ({ ...f, publicPhone: e.target.value }))} maxLength={40} placeholder="+229 …" />
                                        </Field>
                                    </div>

                                    <div style={{ marginTop: 14 }}>
                                        <Field label="Présentation publique">
                                            <textarea
                                                value={form.publicDescription ?? ""}
                                                onChange={(e) => setForm((f) => ({ ...f, publicDescription: e.target.value }))}
                                                maxLength={2000}
                                                rows={4}
                                                placeholder="Quelques lignes de présentation affichées sur la fiche publique."
                                                style={{ width: "100%", padding: 12, borderRadius: "var(--eduflow-radius-input)", border: "1px solid var(--eduflow-border-default)", background: "var(--eduflow-surface-card)", fontFamily: "inherit", fontSize: 13, color: "var(--eduflow-text-primary)", resize: "vertical" }}
                                            />
                                        </Field>
                                    </div>

                                    <div style={{ marginTop: 14 }}>
                                        <SubLabel>Image de couverture</SubLabel>
                                        <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
                                            {form.coverImage ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={form.coverImage} alt="Couverture" style={{ width: 120, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--eduflow-border-subtle)" }} />
                                            ) : (
                                                <div style={{ width: 120, height: 60, borderRadius: 8, background: "var(--eduflow-surface-sunken)", border: "1px dashed var(--eduflow-border-default)" }} />
                                            )}
                                            <label className="inline-flex items-center gap-1 rounded-md cursor-pointer" style={{ fontSize: 12, fontWeight: 600, padding: "8px 12px", background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-default)", color: "var(--eduflow-text-primary)" }}>
                                                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Téléverser"}
                                                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleCoverFile} disabled={uploading} />
                                            </label>
                                            {form.coverImage ? (
                                                <button type="button" onClick={() => setForm((f) => ({ ...f, coverImage: "" }))} style={{ fontSize: 12, fontWeight: 600, color: "var(--eduflow-text-tertiary)" }}>
                                                    Retirer
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="flex flex-wrap items-center justify-between gap-2"
                                    style={{
                                        marginTop: 24,
                                        paddingTop: 20,
                                        borderTop: "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
                                    <SaveStatus
                                        status={saveStatus}
                                        lastSavedAt={lastSavedAt}
                                        error={saveError}
                                        isOnline={isOnline}
                                        onRetry={saveNow}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleCancel}
                                            disabled={!dirty || saving}
                                        >
                                            Annuler
                                        </Button>
                                        <Button type="submit" disabled={!dirty || saving}>
                                            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                            Enregistrer maintenant
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>
        </PageGuard>
    );
}

function SubLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
            }}
        >
            {children}
        </div>
    );
}

function Field({
    label,
    hint,
    required,
    children,
}: {
    label: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <div className="flex items-center justify-between">
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: "var(--eduflow-text-secondary)",
                    }}
                >
                    {label}{required && <span style={{ color: "var(--eduflow-danger-600)" }}> *</span>}
                </span>
                {hint && (
                    <span style={{ fontSize: 10, color: "var(--eduflow-text-tertiary)" }}>
                        {hint}
                    </span>
                )}
            </div>
            <div className="mt-1.5">{children}</div>
        </label>
    );
}
