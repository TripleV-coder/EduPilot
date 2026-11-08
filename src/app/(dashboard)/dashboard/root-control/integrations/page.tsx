"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils/error-message";

/**
 * Console root › Intégrations : passerelle SMS, appels vocaux et WhatsApp,
 * réglés ici plutôt que dans le fichier .env (2026-11-08). Les secrets ne sont
 * jamais réaffichés : seuls leurs 4 derniers caractères le sont.
 */
type Setting = {
    name: string;
    group: "sms" | "voice" | "whatsapp";
    label: string;
    secret: boolean;
    source: "env" | "console" | "unset";
    display: string | null;
};

const GROUPS: { id: Setting["group"]; title: string; description: string }[] = [
    { id: "sms", title: "SMS", description: "Passerelle HTTP du fournisseur de SMS (absences, rappels, codes)." },
    { id: "voice", title: "Appels vocaux", description: "Passerelle qui passe les appels des notifications vocales." },
    { id: "whatsapp", title: "WhatsApp", description: "API Meta Cloud : numéro, jeton et modèle de message approuvé." },
];

export default function RootIntegrationsPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <RootIntegrationsContent />
        </PageGuard>
    );
}

function RootIntegrationsContent() {
    const [settings, setSettings] = useState<Setting[] | null>(null);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetch("/api/root/integrations", { cache: "no-store" })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || "Réglages indisponibles.");
                setSettings(body.settings);
            })
            .catch((err) => setError(getErrorMessage(err)));
    }, []);

    const save = async (values: Record<string, string>) => {
        if (Object.keys(values).length === 0) return;
        setSaving(true);
        try {
            const res = await fetch("/api/root/integrations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ values }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Enregistrement impossible.");
            setSettings(body.settings);
            setDraft({});
            toast({ title: "Réglages enregistrés", description: "Ils s'appliquent tout de suite, sans redémarrage." });
        } catch (err) {
            toast({ title: "Échec", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const changed = Object.fromEntries(Object.entries(draft).filter(([, value]) => value.trim() !== ""));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Intégrations"
                description="SMS, appels vocaux et WhatsApp de la plateforme. Une variable d'environnement du même nom reste prioritaire."
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!settings && !error ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </p>
            ) : null}
            {settings
                ? GROUPS.map((group) => (
                      <Card key={group.id} className="border-border">
                          <CardHeader>
                              <CardTitle>{group.title}</CardTitle>
                              <CardDescription>{group.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-4">
                              {settings
                                  .filter((s) => s.group === group.id)
                                  .map((s) => (
                                      <div key={s.name} className="grid gap-1.5">
                                          <Label htmlFor={s.name}>{s.label}</Label>
                                          <p className="text-xs text-muted-foreground">
                                              {s.source === "env"
                                                  ? `Défini par la variable d'environnement ${s.name} (prioritaire) : ${s.display}`
                                                  : s.source === "console"
                                                    ? `Actuel : ${s.display}`
                                                    : "Non configuré"}
                                          </p>
                                          <div className="flex gap-2">
                                              <Input
                                                  id={s.name}
                                                  type={s.secret ? "password" : "text"}
                                                  autoComplete="off"
                                                  disabled={s.source === "env" || saving}
                                                  placeholder={s.secret ? "Nouvelle valeur (laisser vide pour garder l'actuelle)" : "Nouvelle valeur"}
                                                  value={draft[s.name] ?? ""}
                                                  onChange={(e) => setDraft((d) => ({ ...d, [s.name]: e.target.value }))}
                                              />
                                              {s.source === "console" ? (
                                                  <Button
                                                      type="button"
                                                      variant="outline"
                                                      disabled={saving}
                                                      onClick={() => void save({ [s.name]: "" })}
                                                  >
                                                      Effacer
                                                  </Button>
                                              ) : null}
                                          </div>
                                      </div>
                                  ))}
                          </CardContent>
                      </Card>
                  ))
                : null}
            {settings ? (
                <div className="flex justify-end">
                    <Button type="button" disabled={saving || Object.keys(changed).length === 0} onClick={() => void save(changed)}>
                        {saving ? "Enregistrement…" : "Enregistrer"}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
