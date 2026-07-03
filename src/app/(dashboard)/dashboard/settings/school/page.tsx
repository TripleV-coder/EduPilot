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
import { Loader2, Check, Building2 } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";

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
};

export default function SchoolIdentityPage() {
    const { schoolId } = useSchool();
    const { data: school, isLoading, mutate } = useSWR<SchoolProfile>(
        schoolId ? `/api/schools/${schoolId}` : null,
        fetcher,
    );

    const [form, setForm] = useState<SchoolProfile>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

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
        });
    }, [school]);

    const dirty = !!school && (
        form.name !== (school.name ?? "") ||
        form.code !== (school.code ?? "") ||
        form.motto !== (school.motto ?? "") ||
        form.mempCode !== (school.mempCode ?? "") ||
        form.emailDomain !== (school.emailDomain ?? "") ||
        form.logo !== (school.logo ?? "") ||
        form.primaryColor !== ((school.primaryColor as PrimaryColor) ?? "brand")
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!schoolId) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/schools/${schoolId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    motto: form.motto || null,
                    mempCode: form.mempCode || null,
                    emailDomain: form.emailDomain || null,
                    logo: form.logo || null,
                    primaryColor: form.primaryColor,
                }),
            });
            if (!res.ok) throw new Error("Échec de l'enregistrement");
            await mutate();
            toast.success("Identité enregistrée.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
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
            });
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
            toast.success("Logo téléversé. N'oublie pas d'enregistrer.");
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

                                <div
                                    className="flex justify-end gap-2"
                                    style={{
                                        marginTop: 24,
                                        paddingTop: 20,
                                        borderTop: "1px solid var(--eduflow-border-subtle)",
                                    }}
                                >
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
                                        Enregistrer
                                    </Button>
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
