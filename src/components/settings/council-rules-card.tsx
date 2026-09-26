"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Input } from "@/components/edu";

type Rules = {
    honorMin: number;
    encouragementMin: number;
    workWarningBelow: number;
    conductIncidents: number;
};

const FIELDS: { key: keyof Rules; label: string; helper: string; step: number; max: number }[] = [
    { key: "honorMin", label: "Tableau d'honneur à partir de", helper: "Moyenne sur 20", step: 0.25, max: 20 },
    { key: "encouragementMin", label: "Encouragements à partir de", helper: "Moyenne sur 20", step: 0.25, max: 20 },
    { key: "workWarningBelow", label: "Avertissement travail en dessous de", helper: "Moyenne sur 20", step: 0.25, max: 20 },
    { key: "conductIncidents", label: "Avertissement conduite à partir de", helper: "Incidents sur la période", step: 1, max: 50 },
];

/** Seuils des mentions proposées au conseil de classe (API /api/config/council-rules). */
export function CouncilRulesCard() {
    const [rules, setRules] = useState<Rules | null>(null);
    const [draft, setDraft] = useState<Record<keyof Rules, string> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/config/council-rules")
            .then(async (res) => {
                if (!res.ok) throw new Error("Impossible de charger les seuils du conseil de classe.");
                const data = (await res.json()) as { rules: Rules };
                setRules(data.rules);
                setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(data.rules[f.key])])) as Record<keyof Rules, string>);
            })
            .catch((err: Error) => setError(err.message));
    }, []);

    const save = async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        try {
            const body = Object.fromEntries(FIELDS.map((f) => [f.key, Number(draft[f.key].replace(",", "."))]));
            const res = await fetch("/api/config/council-rules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
            setRules(data.rules);
            toast.success("Seuils du conseil de classe enregistrés.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Enregistrement impossible.");
        } finally {
            setSaving(false);
        }
    };

    const dirty = rules && draft ? FIELDS.some((f) => String(rules[f.key]) !== draft[f.key]) : false;

    return (
        <Card padding={24}>
            <h2 className="eduflow-display" style={{ fontSize: 16, margin: "0 0 6px" }}>
                Mentions du conseil de classe
            </h2>
            <p style={{ fontSize: 13, color: "var(--eduflow-text-secondary)", margin: "0 0 18px" }}>
                Seuils utilisés pour proposer une mention à chaque élève. Le conseil peut toujours modifier la décision.
            </p>
            {error ? (
                <p role="alert" style={{ fontSize: 13, color: "var(--eduflow-danger-700)", margin: "0 0 12px" }}>
                    {error}
                </p>
            ) : null}
            {draft ? (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {FIELDS.map((f) => (
                            <Input
                                key={f.key}
                                label={f.label}
                                helper={f.helper}
                                type="number"
                                min={0}
                                max={f.max}
                                step={f.step}
                                value={draft[f.key]}
                                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                            />
                        ))}
                    </div>
                    <div style={{ marginTop: 18 }}>
                        <Button icon="check" loading={saving} disabled={!dirty || saving} onClick={save}>
                            Enregistrer les seuils
                        </Button>
                    </div>
                </>
            ) : !error ? (
                <p style={{ fontSize: 13, color: "var(--eduflow-text-tertiary)" }}>Chargement…</p>
            ) : null}
        </Card>
    );
}
