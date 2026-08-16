"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { Badge, Button, Card, Icon, Input } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { SubLabel } from "@/components/edu-homes/_shared";

type Template = {
  id: string;
  slug: string | null;
  name: string;
  category: string;
  body: string;
  isActive: boolean;
  autoTrigger?: string;
};

const VARIABLES = [
  "{parent.prenom}",
  "{eleve.prenom}",
  "{eleve.nom}",
  "{eleve.classe}",
  "{montant}",
  "{echeance.date}",
  "{periode}",
  "{conseil.date}",
  "{absence.date}",
  "{ecole.nom}",
  "{lien.paiement}",
  "{lien.bulletin}",
];

const CATEGORIES = ["Pédagogie", "Vie scolaire", "Finance", "Administration"];

function interpolatePreview(body: string): string {
  return body
    .replaceAll("{parent.prenom}", "Patrick")
    .replaceAll("{eleve.prenom}", "Aïcha")
    .replaceAll("{eleve.nom}", "Hounsou")
    .replaceAll("{eleve.classe}", "3ᵉ A")
    .replaceAll("{montant}", "125 000")
    .replaceAll("{echeance.date}", "11 mai")
    .replaceAll("{periode}", "T2 2025-2026")
    .replaceAll("{conseil.date}", "jeudi 14h")
    .replaceAll("{conseil.heure}", "16h00")
    .replaceAll("{absence.date}", "lundi matin")
    .replaceAll("{ecole.nom}", "CBE")
    .replaceAll("{lien.paiement}", "edupilot.bj/p/A0142")
    .replaceAll("{lien.bulletin}", "edupilot.bj/b/A0142-T2")
    .replaceAll("{lien.echeancier}", "edupilot.bj/e/A0142")
    .replaceAll("{paiement.recu}", "FLW-882104")
    .replaceAll("{bepc.session}", "juin 2026")
    .replaceAll("{bepc.centre}", "LycéeC")
    .replaceAll("{bepc.date}", "12 juin")
    .replaceAll("{sortie.lieu}", "Ouidah")
    .replaceAll("{sortie.date}", "16 mai")
    .replaceAll("{sortie.deadline}", "14 mai")
    .replaceAll("{retards.count}", "4")
    .replaceAll("{incident.motif}", "mal de tête")
    .replaceAll("{annee.scolaire}", "2026-2027")
    .replaceAll("{plan.tranches}", "3")
    .replaceAll("{documents.liste}", "acte de naissance, photo")
    .replaceAll("{deadline}", "vendredi");
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/communication/templates");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Impossible de charger les modèles");
      }
      const list = (data.templates ?? []) as Template[];
      setTemplates(list);
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const active = useMemo(
    () => templates.find((t) => t.id === activeId) ?? templates[0] ?? null,
    [templates, activeId]
  );

  const currentBody = draft ?? active?.body ?? "";
  const charCount = currentBody.length;
  const segCount = Math.max(1, Math.ceil(charCount / 160) || 1);
  const preview = useMemo(() => interpolatePreview(currentBody), [currentBody]);

  const grouped = useMemo(() => {
    const filteredItems = templates.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    );
    return CATEGORIES.map((cat) => ({
      category: cat,
      items: filteredItems.filter((t) => t.category === cat),
    }));
  }, [templates, search]);

  const switchTemplate = (id: string) => {
    setActiveId(id);
    setDraft(null);
  };

  const saveActive = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/communication/templates/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: currentBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Enregistrement impossible");
      }
      const updated = data.template as Template;
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setDraft(null);
      toast.success("Modèle enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/communication/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nouveau modèle",
          category: "Administration",
          body: "Bonjour {parent.prenom}, message de {ecole.nom}.",
          isActive: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Création impossible");
      }
      const created = data.template as Template;
      setTemplates((prev) => [...prev, created]);
      setActiveId(created.id);
      setDraft(null);
      toast.success("Modèle créé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de création");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}>
        <PageShell className="eduflow-scope pb-12">
          <PageLoading label="Chargement des modèles…" />
        </PageShell>
      </PageGuard>
    );
  }

  if (error) {
    return (
      <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}>
        <PageShell className="eduflow-scope pb-12">
          <PageError message={error} onRetry={() => void loadTemplates()} />
        </PageShell>
      </PageGuard>
    );
  }

  return (
    <PageGuard
      permission={Permission.SCHOOL_READ}
      roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}
    >
      <PageShell className="eduflow-scope pb-12">
        <PageHeader
          title="Modèles de communication"
          description="Email · SMS · WhatsApp — modèles persistés par établissement"
          breadcrumbs={[
            { label: "Tableau de bord", href: "/dashboard" },
            { label: "Communication" },
            { label: "Modèles" },
          ]}
          actions={
            <Button icon="plus" onClick={() => void createTemplate()} disabled={creating}>
              {creating ? "Création…" : "Nouveau modèle"}
            </Button>
          }
        />

        <Card padding={14} style={{ background: "var(--brand-50)", border: "1px solid var(--brand-200)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="info" size={16} color="var(--brand-700)" style={{ marginTop: 2 }} />
            <div style={{ fontSize: 12, color: "var(--brand-800)", lineHeight: 1.55 }}>
              Catalogue lié à <code>CommunicationTemplate</code> · seed automatique de 12 modèles au
              premier accès · les modifications sont enregistrées en base pour votre école.
            </div>
          </div>
        </Card>

        {!active ? (
          <Card padding={24}>
            <p style={{ margin: 0, color: "var(--eduflow-text-secondary)" }}>
              Aucun modèle pour cet établissement. Créez-en un pour commencer.
            </p>
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "320px 1fr",
              gap: 14,
              minHeight: 600,
            }}
            className="tpl-grid"
          >
            <Card padding={0} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 14, borderBottom: "1px solid var(--eduflow-border-subtle)" }}>
                <Input
                  icon="search"
                  placeholder="Rechercher un modèle…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ overflowY: "auto" }}>
                {grouped.map((cat) => (
                  <div key={cat.category}>
                    <div
                      style={{
                        padding: "10px 14px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--eduflow-text-tertiary)",
                        background: "var(--eduflow-surface-sunken)",
                      }}
                    >
                      {cat.category}
                    </div>
                    {cat.items.length === 0 ? null : (
                      cat.items.map((it) => {
                        const isActive = it.id === active.id;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => switchTemplate(it.id)}
                            style={{
                              padding: "10px 14px",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              background: isActive ? "var(--brand-50)" : "transparent",
                              borderLeft: isActive
                                ? "3px solid var(--brand-700)"
                                : "3px solid transparent",
                              border: 0,
                              borderRight: 0,
                              borderTop: 0,
                              borderBottom: 0,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textAlign: "left",
                            }}
                          >
                            <Icon
                              name="sms"
                              size={14}
                              color={isActive ? "var(--brand-700)" : "var(--eduflow-text-tertiary)"}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: isActive ? 700 : 500,
                                color: isActive
                                  ? "var(--brand-800)"
                                  : "var(--eduflow-text-primary)",
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {it.name}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card padding={0} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--eduflow-border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <h3 className="eduflow-display" style={{ fontSize: 16, margin: 0 }}>
                    {active.name}
                  </h3>
                  <div style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)", marginTop: 2 }}>
                    Multi-canaux · {active.autoTrigger ?? "Déclenché manuellement"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge variant={active.isActive ? "success" : "neutral"} size="sm" dot>
                    {active.isActive ? "Actif" : "Inactif"}
                  </Badge>
                  <Button
                    size="sm"
                    icon="check"
                    disabled={saving || draft === null}
                    onClick={() => void saveActive()}
                  >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </div>
              <div
                style={{
                  padding: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  flex: 1,
                }}
                className="tpl-edit"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <SubLabel>SMS · 160 caractères par segment</SubLabel>
                    <textarea
                      value={currentBody}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={6}
                      style={{
                        width: "100%",
                        padding: 14,
                        background: "var(--eduflow-surface-sunken)",
                        borderRadius: 12,
                        fontSize: 13,
                        lineHeight: 1.55,
                        marginTop: 8,
                        fontFamily: "var(--font-body, Inter), system-ui, sans-serif",
                        color: "var(--eduflow-text-primary)",
                        border: "1px solid var(--eduflow-border-subtle)",
                        resize: "vertical",
                      }}
                    />
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: "var(--eduflow-text-tertiary)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        {charCount} caractères · {segCount} SMS
                      </span>
                      {draft !== null ? (
                        <button
                          type="button"
                          onClick={() => setDraft(null)}
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "var(--brand-700)",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Restaurer l&apos;original
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <SubLabel>Variables disponibles</SubLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {VARIABLES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDraft((currentBody || "") + " " + v)}
                          style={{
                            fontSize: 10,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "var(--brand-50)",
                            color: "var(--brand-800)",
                            border: "1px solid var(--brand-200)",
                            fontFamily: "var(--font-mono, ui-monospace, monospace)",
                            cursor: "pointer",
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <SubLabel>Aperçu · téléphone parent (données d&apos;exemple)</SubLabel>
                    <div
                      style={{
                        marginTop: 8,
                        padding: 16,
                        background: "var(--eduflow-neutral-900, #0F172A)",
                        borderRadius: 22,
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          background: "#fff",
                          borderRadius: 14,
                          padding: 14,
                          fontSize: 13,
                          lineHeight: 1.55,
                          color: "#0F172A",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--eduflow-text-tertiary)",
                            marginBottom: 6,
                          }}
                        >
                          Aperçu · à l&apos;instant
                        </div>
                        {preview}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 14,
                      background: "var(--eduflow-surface-sunken)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "var(--eduflow-text-secondary)",
                      lineHeight: 1.55,
                    }}
                  >
                    <strong>Statistiques d&apos;envoi</strong>
                    <br />
                    Aucune métrique réelle pour l&apos;instant — elles apparaîtront lorsque les
                    envois seront journalisés via les canaux SMS / WhatsApp.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </PageShell>

      <style jsx global>{`
        @media (max-width: 960px) {
          .tpl-grid {
            grid-template-columns: 1fr !important;
          }
          .tpl-edit {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageGuard>
  );
}
