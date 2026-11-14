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
 * Console root › Intégrations : e-mail, passerelle SMS, appels vocaux et
 * WhatsApp, réglés ici plutôt que dans le fichier .env (2026-11-08 ; e-mail
 * le 2026-11-12). Les secrets ne sont
 * jamais réaffichés : seuls leurs 4 derniers caractères le sont.
 */
type Setting = {
    name: string;
    group: "email" | "sms" | "voice" | "whatsapp";
    label: string;
    secret: boolean;
    source: "env" | "console" | "unset";
    display: string | null;
};

const GROUPS: { id: Setting["group"]; title: string; description: string }[] = [
    {
        id: "email",
        title: "E-mail",
        description:
            "Réinitialisations de mot de passe, invitations, avis. Une clé Resend ou SendGrid, ou un serveur SMTP, plus l'adresse d'expédition.",
    },
    {
        id: "whatsapp",
        title: "WhatsApp (canal principal)",
        description:
            "Canal prioritaire des messages aux familles : absences, paiements, notes, annonces. API Meta Cloud : numéro, jeton, modèles approuvés (un par type, sinon le modèle par défaut), clé secrète de l'application pour recevoir les statuts.",
    },
    { id: "sms", title: "SMS (secours)", description: "Passerelle HTTP du fournisseur de SMS. Utilisée seulement quand WhatsApp n'est pas configuré ou n'atteint pas la famille (numéro sans WhatsApp, échec de remise)." },
    { id: "voice", title: "Appels vocaux", description: "Passerelle qui passe les appels des notifications vocales." },
];

type WebhookInfo = { url: string | null; verifyToken: string | null; appSecretConfigured: boolean };

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
    const [testing, setTesting] = useState(false);
    const [webhook, setWebhook] = useState<WebhookInfo | null>(null);
    const [waTo, setWaTo] = useState("");
    const [waTesting, setWaTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetch("/api/root/integrations", { cache: "no-store" })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || "Réglages indisponibles.");
                setSettings(body.settings);
                setWebhook(body.whatsappWebhook ?? null);
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
            setWebhook(body.whatsappWebhook ?? null);
            setDraft({});
            toast({ title: "Réglages enregistrés", description: "Ils s'appliquent tout de suite, sans redémarrage." });
        } catch (err) {
            toast({ title: "Échec", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const sendTestEmail = async () => {
        setTesting(true);
        try {
            const res = await fetch("/api/root/integrations/test-email", { method: "POST" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Envoi impossible.");
            toast({ title: "E-mail d'essai envoyé", description: `Vérifiez la boîte de réception de ${body.to}.` });
        } catch (err) {
            toast({ title: "Échec de l'envoi", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setTesting(false);
        }
    };

    const sendTestWhatsApp = async () => {
        setWaTesting(true);
        try {
            const res = await fetch("/api/root/integrations/test-whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to: waTo }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Envoi impossible.");
            toast({ title: "Accepté par WhatsApp", description: "Vérifiez le téléphone : la remise est confirmée ensuite par le webhook." });
        } catch (err) {
            toast({ title: "Échec de l'envoi WhatsApp", description: getErrorMessage(err), variant: "destructive" });
        } finally {
            setWaTesting(false);
        }
    };

    const changed = Object.fromEntries(Object.entries(draft).filter(([, value]) => value.trim() !== ""));

    return (
        <div className="space-y-6">
            <PageHeader
                title="Intégrations"
                description="E-mail, WhatsApp (canal principal des familles), SMS (secours) et appels vocaux de la plateforme. Une variable d'environnement du même nom reste prioritaire."
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
                              {group.id === "email" ? (
                                  <div className="flex flex-wrap items-center gap-3">
                                      <Button
                                          type="button"
                                          variant="outline"
                                          disabled={testing || saving || Object.keys(changed).length > 0}
                                          onClick={() => void sendTestEmail()}
                                      >
                                          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                          Envoyer un e-mail d&apos;essai
                                      </Button>
                                      <p className="text-xs text-muted-foreground">
                                          {Object.keys(changed).length > 0
                                              ? "Enregistrez d'abord vos modifications."
                                              : "Envoyé à votre propre adresse, avec les réglages en vigueur."}
                                      </p>
                                  </div>
                              ) : null}
                              {group.id === "whatsapp" ? (
                                  <div className="grid gap-3 rounded-md border border-border p-3">
                                      <p className="text-sm font-medium">Statuts des messages (livré, lu, échoué)</p>
                                      <p className="text-xs text-muted-foreground">
                                          À déclarer dans Meta › WhatsApp › Configuration › Webhook (champ « messages »). Sans cela, les échecs ne
                                          sont pas connus et le SMS de secours ne part qu&apos;en cas de refus immédiat.
                                      </p>
                                      <dl className="grid gap-1 text-xs">
                                          <dt className="text-muted-foreground">Adresse de rappel</dt>
                                          <dd className="break-all font-mono">{webhook?.url ?? "Adresse publique inconnue (NEXTAUTH_URL)"}</dd>
                                          <dt className="text-muted-foreground">Jeton de vérification</dt>
                                          <dd className="break-all font-mono">{webhook?.verifyToken ?? "Indisponible : secret maître absent"}</dd>
                                          <dt className="text-muted-foreground">Clé secrète de l&apos;application</dt>
                                          <dd>{webhook?.appSecretConfigured ? "Renseignée : les statuts signés sont acceptés" : "À renseigner ci-dessus : sans elle, les statuts sont refusés"}</dd>
                                      </dl>
                                      <div className="flex flex-wrap items-end gap-2">
                                          <div className="grid gap-1.5">
                                              <Label htmlFor="wa-test-to">Numéro pour un WhatsApp d&apos;essai</Label>
                                              <Input
                                                  id="wa-test-to"
                                                  inputMode="tel"
                                                  placeholder="0197000000"
                                                  value={waTo}
                                                  disabled={waTesting}
                                                  onChange={(e) => setWaTo(e.target.value)}
                                              />
                                          </div>
                                          <Button
                                              type="button"
                                              variant="outline"
                                              disabled={waTesting || saving || waTo.trim().length < 8 || Object.keys(changed).length > 0}
                                              onClick={() => void sendTestWhatsApp()}
                                          >
                                              {waTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                              Envoyer un WhatsApp d&apos;essai
                                          </Button>
                                      </div>
                                  </div>
                              ) : null}
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
