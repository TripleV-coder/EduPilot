"use client";

import * as React from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { fetcher } from "@/lib/fetcher";
import { useSchool } from "@/components/providers/school-provider";
import { Badge, Button, Card, Input } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";

/**
 * Paiement en ligne de l'établissement (S7, ADR-0011).
 *
 * Chaque école encaisse sur SON compte FedaPay. L'administrateur de l'école
 * enregistre ses clés (chiffrées côté serveur, jamais réaffichées), les teste,
 * puis active le compte ; l'ancien compte actif est alors révoqué. La
 * direction et la comptabilité consultent l'état sans pouvoir le modifier.
 */
type Account = {
    id: string;
    environment: "SANDBOX" | "LIVE";
    status: "INACTIVE" | "ACTIVE" | "REVOKED";
    secretKeyLast4: string;
    lastVerifiedAt: string | null;
    activatedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    webhookPath: string;
};
type AccountsResponse = {
    data: Account[];
    collectingEnvironment: "SANDBOX" | "LIVE";
    liveEnabled: boolean;
    secretsAvailable: boolean;
};

const ENV_LABEL = { SANDBOX: "Test (bac à sable)", LIVE: "Production (argent réel)" } as const;
const STATUS: Record<Account["status"], { label: string; variant: "success" | "neutral" | "warning" }> = {
    ACTIVE: { label: "Actif : encaisse les paiements", variant: "success" },
    INACTIVE: { label: "Enregistré, non activé", variant: "warning" },
    REVOKED: { label: "Révoqué", variant: "neutral" },
};
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function SchoolPaymentsSettingsPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "NETWORK_ADMIN"]}>
            <SchoolPaymentsContent />
        </PageGuard>
    );
}

function SchoolPaymentsContent() {
    const { schoolId } = useSchool();
    const { data: session } = useSession();
    const canWrite = session?.user?.role === "SCHOOL_ADMIN" || session?.user?.role === "SUPER_ADMIN";
    const url = schoolId ? `/api/schools/${schoolId}/payment-accounts` : null;
    const { data, error, isLoading, mutate } = useSWR<AccountsResponse>(url, fetcher, { revalidateOnFocus: false });

    const [environment, setEnvironment] = React.useState<Account["environment"]>("SANDBOX");
    const [secretKey, setSecretKey] = React.useState("");
    const [webhookSecret, setWebhookSecret] = React.useState("");
    const [busy, setBusy] = React.useState<string | null>(null);
    const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);
    const origin = typeof window === "undefined" ? "" : window.location.origin;

    async function call(path: string, body: unknown, key: string, success: string) {
        setBusy(key);
        setFeedback(null);
        try {
            const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || "Opération refusée.");
            await mutate();
            if (payload.result === "invalid") {
                setFeedback({ type: "error", msg: "FedaPay refuse cette clé. Vérifiez-la dans votre tableau de bord FedaPay." });
            } else if (payload.result === "unreachable") {
                setFeedback({ type: "error", msg: "FedaPay est injoignable pour le moment. Réessayez plus tard." });
            } else {
                setFeedback({ type: "success", msg: success });
            }
            return true;
        } catch (e) {
            setFeedback({ type: "error", msg: e instanceof Error ? e.message : "Erreur." });
            return false;
        } finally {
            setBusy(null);
        }
    }

    async function register(e: React.FormEvent) {
        e.preventDefault();
        if (!url) return;
        const ok = await call(url, { environment, secretKey, webhookSecret }, "create",
            "Compte enregistré. Déclarez son adresse de webhook chez FedaPay, testez-le, puis activez-le.");
        // Les secrets ne restent jamais à l'écran
        if (ok) {
            setSecretKey("");
            setWebhookSecret("");
        }
    }

    return (
        <PageShell className="max-w-4xl pb-12">
            <PageHeader
                title="Paiement en ligne"
                description="Les parents paient directement sur le compte FedaPay de l'établissement. EduPilot ne détient ni ne redistribue les fonds."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Paramètres", href: "/dashboard/settings" },
                    { label: "Paiement en ligne" },
                ]}
            />

            {!schoolId ? (
                <PageError message="Sélectionnez d'abord un établissement." />
            ) : isLoading || (!data && !error) ? (
                <PageLoading label="Chargement des comptes…" />
            ) : error ? (
                <PageError message="Impossible de charger les comptes de paiement. Réessayez." onRetry={() => void mutate()} />
            ) : data ? (
                <div style={{ display: "grid", gap: 16 }}>
                    <Card padding={18}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 13 }}>Cette installation encaisse en :</span>
                            <Badge variant={data.collectingEnvironment === "LIVE" ? "success" : "warning"} size="sm">
                                {ENV_LABEL[data.collectingEnvironment]}
                            </Badge>
                        </div>
                        {!data.secretsAvailable ? (
                            <p role="alert" style={{ fontSize: 13, color: "var(--eduflow-danger-600)", marginTop: 10 }}>
                                Le chiffrement des clés n&apos;est pas configuré sur ce serveur : aucun compte ne peut être enregistré
                                et le paiement en ligne est indisponible. Contactez l&apos;exploitant de la plateforme.
                            </p>
                        ) : null}
                        <ol style={{ fontSize: 13, color: "var(--eduflow-text-secondary)", marginTop: 12, paddingLeft: 18, display: "grid", gap: 4 }}>
                            <li>Ouvrez un compte FedaPay au nom de l&apos;établissement.</li>
                            <li>Enregistrez ci-dessous sa clé secrète et le secret de son webhook.</li>
                            <li>Dans FedaPay (Workbench → Webhooks), déclarez l&apos;adresse de webhook affichée pour ce compte.</li>
                            <li>Testez la clé, puis activez le compte. Sans compte actif, les parents règlent à l&apos;économat.</li>
                        </ol>
                    </Card>

                    <section aria-labelledby="accounts-title" style={{ display: "grid", gap: 10 }}>
                        <h2 id="accounts-title" className="eduflow-display" style={{ fontSize: 16, fontWeight: 700 }}>Comptes de l&apos;établissement</h2>
                        {data.data.length === 0 ? (
                            <Card padding={18}>
                                <p style={{ fontSize: 13 }}>Aucun compte enregistré : le paiement en ligne est indisponible pour cet établissement.</p>
                            </Card>
                        ) : (
                            data.data.map((a) => (
                                <Card key={a.id} padding={18}>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                        <span className="eduflow-display" style={{ fontSize: 15, fontWeight: 700 }}>FedaPay ••••{a.secretKeyLast4}</span>
                                        <Badge variant="neutral" size="sm">{ENV_LABEL[a.environment]}</Badge>
                                        <Badge variant={STATUS[a.status].variant} size="sm" dot>{STATUS[a.status].label}</Badge>
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", marginTop: 8, display: "grid", gap: 2 }}>
                                        <div>Clé testée le : {fmtDate(a.lastVerifiedAt)}</div>
                                        {a.activatedAt ? <div>Activé le : {fmtDate(a.activatedAt)}</div> : null}
                                        {a.revokedAt ? <div>Révoqué le : {fmtDate(a.revokedAt)}</div> : null}
                                        {a.status !== "REVOKED" ? (
                                            <div style={{ wordBreak: "break-all" }}>
                                                Adresse de webhook à déclarer chez FedaPay : <code>{origin}{a.webhookPath}</code>
                                            </div>
                                        ) : null}
                                    </div>
                                    {canWrite && a.status !== "REVOKED" ? (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                            <Button variant="secondary" size="sm" loading={busy === `verify-${a.id}`}
                                                onClick={() => void call(`${url}/${a.id}`, { action: "verify" }, `verify-${a.id}`, "Clé acceptée par FedaPay.")}>
                                                Tester la clé
                                            </Button>
                                            {a.status === "INACTIVE" ? (
                                                <Button size="sm" disabled={!a.lastVerifiedAt} loading={busy === `activate-${a.id}`}
                                                    onClick={() => void call(`${url}/${a.id}`, { action: "activate" }, `activate-${a.id}`, "Compte activé : il encaisse désormais les paiements en ligne.")}>
                                                    Activer
                                                </Button>
                                            ) : null}
                                            <Button variant="danger" size="sm" loading={busy === `revoke-${a.id}`}
                                                onClick={() => {
                                                    if (window.confirm("Révoquer ce compte ? Il n'encaissera plus aucun paiement ; ses paiements passés restent suivis.")) {
                                                        void call(`${url}/${a.id}`, { action: "revoke" }, `revoke-${a.id}`, "Compte révoqué.");
                                                    }
                                                }}>
                                                Révoquer
                                            </Button>
                                        </div>
                                    ) : null}
                                </Card>
                            ))
                        )}
                    </section>

                    {canWrite && data.secretsAvailable ? (
                        <form onSubmit={register} aria-labelledby="new-account-title" style={{ display: "grid", gap: 12 }}>
                            <h2 id="new-account-title" className="eduflow-display" style={{ fontSize: 16, fontWeight: 700 }}>Enregistrer un compte FedaPay</h2>
                            <fieldset style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, border: 0, padding: 0 }}>
                                <legend style={{ fontSize: 13, marginBottom: 6 }}>Environnement</legend>
                                {(["SANDBOX", "LIVE"] as const).map((env) => (
                                    <label key={env} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <input type="radio" name="environment" value={env} checked={environment === env} onChange={() => setEnvironment(env)} />
                                        {ENV_LABEL[env]}
                                    </label>
                                ))}
                            </fieldset>
                            <Input label="Clé secrète" type="password" autoComplete="off" required value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                helper={environment === "LIVE" ? "Commence par sk_live" : "Commence par sk_sandbox"} />
                            <Input label="Secret du webhook" type="password" autoComplete="off" required value={webhookSecret}
                                onChange={(e) => setWebhookSecret(e.target.value)}
                                helper="Dans FedaPay : Workbench → Webhooks → votre point de terminaison → Click to reveal" />
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <Button type="submit" icon="check" loading={busy === "create"} disabled={!secretKey || !webhookSecret}>
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    ) : null}

                    {feedback ? (
                        <div role={feedback.type === "error" ? "alert" : "status"}
                            style={{
                                fontSize: 13, borderRadius: 10, padding: "10px 14px",
                                color: feedback.type === "error" ? "var(--eduflow-danger-600)" : "var(--eduflow-success-700)",
                                background: feedback.type === "error" ? "rgba(239,68,68,0.08)" : "var(--eduflow-success-50)",
                            }}>
                            {feedback.msg}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </PageShell>
    );
}
