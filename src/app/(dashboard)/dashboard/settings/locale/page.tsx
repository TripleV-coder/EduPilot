"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { AUTHENTICATED_DASHBOARD_ROLES } from "@/lib/rbac/permissions";

import { Button, Card, Icon, SaveStatus } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { useAutoSave } from "@/hooks/use-autosave";

interface LocalePrefs {
    language: string;
    timezone: string;
    dateformat: string;
    currency: string;
}

interface ProfileResponse {
    preferences?: {
        locale?: Partial<LocalePrefs>;
        [key: string]: unknown;
    } | null;
}

const defaults: LocalePrefs = {
    language: "fr",
    timezone: "gmt",
    dateformat: "dmy",
    currency: "xof",
};

const LANGUAGE_OPTIONS = [
    { value: "fr", label: "Français (France)" },
    { value: "en", label: "English (US)" },
    { value: "es", label: "Español" },
    { value: "ar", label: "العربية (Arabe) — Bêta" },
];

const TIMEZONE_OPTIONS = [
    { value: "gmt", label: "GMT (Dakar, Abidjan, Cotonou)" },
    { value: "gmt1", label: "GMT+1 (Paris, Kinshasa)" },
    { value: "gmt2", label: "GMT+2 (Kigali, Bujumbura)" },
];

const DATEFORMAT_OPTIONS = [
    { value: "dmy", label: "JJ/MM/AAAA (24/05/2026)" },
    { value: "mdy", label: "MM/JJ/AAAA (05/24/2026)" },
    { value: "ymd", label: "AAAA-MM-JJ (2026-05-24)" },
];

const CURRENCY_OPTIONS = [
    { value: "xof", label: "FCFA (XOF)" },
    { value: "eur", label: "Euro (€)" },
    { value: "usd", label: "Dollar Américain ($)" },
];

export default function LocaleSettingsPage() {
    const { data: profileData, mutate } = useSWR<ProfileResponse>(
        "/api/user/profile",
        fetcher
    );

    const [language, setLanguage] = useState(defaults.language);
    const [timezone, setTimezone] = useState(defaults.timezone);
    const [dateformat, setDateformat] = useState(defaults.dateformat);
    const [currency, setCurrency] = useState(defaults.currency);
    // Passe à true une fois les préférences serveur appliquées : sert de garde
    // pour n'activer l'auto-save qu'après hydratation (pas de save parasite).
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (!profileData) return;
        const prefs = profileData.preferences?.locale;
        if (prefs) {
            if (prefs.language) setLanguage(prefs.language);
            if (prefs.timezone) setTimezone(prefs.timezone);
            if (prefs.dateformat) setDateformat(prefs.dateformat);
            if (prefs.currency) setCurrency(prefs.currency);
        }
        setHydrated(true);
    }, [profileData]);

    const localePrefs: LocalePrefs = { language, timezone, dateformat, currency };

    const {
        status: saveStatus,
        lastSavedAt,
        error: saveError,
        isOnline,
        saveNow,
    } = useAutoSave({
        data: localePrefs,
        enabled: hydrated,
        onSave: async (prefs) => {
            const currentPrefs = profileData?.preferences || {};
            const updatedPrefs = { ...currentPrefs, locale: prefs };
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferences: updatedPrefs }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || "Erreur lors de la sauvegarde");
            }
            await mutate({ ...(profileData || {}), preferences: updatedPrefs }, false);
        },
    });

    const saving = saveStatus === "saving";

    return (
        <PageGuard roles={AUTHENTICATED_DASHBOARD_ROLES}>
            <PageShell className="max-w-4xl pb-12">
                <PageHeader
                    title="Langue & région"
                    description="Configure la langue de l'interface, le fuseau horaire et le format des dates."
                    breadcrumbs={[
                        { label: "Paramètres", href: "/dashboard/settings" },
                        { label: "Langue & région" },
                    ]}
                />

                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="tag" size={18} color="var(--brand-700)" />
                        <div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Langue de l&apos;interface
                            </h3>
                            <p
                                style={{
                                    margin: "2px 0 0",
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                }}
                            >
                                Cette modification ne s&apos;applique qu&apos;à ton compte personnel.
                            </p>
                        </div>
                    </div>
                    <div className="px-5 py-5">
                        <FieldSelect
                            label="Langue"
                            value={language}
                            onChange={setLanguage}
                            options={LANGUAGE_OPTIONS}
                        />
                    </div>
                </Card>

                <Card padding={0}>
                    <div
                        className="flex items-center gap-2 border-b px-5 py-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <Icon name="clock" size={18} color="var(--brand-700)" />
                        <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                            Formats & fuseau horaire
                        </h3>
                    </div>
                    <div
                        className="grid gap-4 px-5 py-5"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
                    >
                        <FieldSelect
                            label="Fuseau horaire"
                            value={timezone}
                            onChange={setTimezone}
                            options={TIMEZONE_OPTIONS}
                        />
                        <FieldSelect
                            label="Format de date"
                            value={dateformat}
                            onChange={setDateformat}
                            options={DATEFORMAT_OPTIONS}
                        />
                        <FieldSelect
                            label="Devise d'affichage"
                            value={currency}
                            onChange={setCurrency}
                            options={CURRENCY_OPTIONS}
                        />
                    </div>
                    <div
                        className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"
                        style={{
                            borderColor: "var(--eduflow-border-subtle)",
                            background: "var(--eduflow-surface-sunken)",
                        }}
                    >
                        <SaveStatus
                            status={saveStatus}
                            lastSavedAt={lastSavedAt}
                            error={saveError}
                            isOnline={isOnline}
                            onRetry={saveNow}
                        />
                        <Button
                            icon={saving ? undefined : "check"}
                            loading={saving}
                            onClick={saveNow}
                        >
                            {saving ? "Enregistrement…" : "Enregistrer maintenant"}
                        </Button>
                    </div>
                </Card>
            </PageShell>
        </PageGuard>
    );
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--eduflow-text-primary)",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
