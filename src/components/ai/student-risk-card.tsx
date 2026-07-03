"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card, Icon } from "@/components/edu";
import {
  callGovernanceAction,
  type InterventionPlan,
} from "@/lib/ai/client-governance";

const PRIORITY_STYLES: Record<
  InterventionPlan["priority"],
  { bg: string; color: string; border: string }
> = {
  CRITICAL: {
    bg: "var(--eduflow-danger-50)",
    color: "var(--eduflow-danger-800)",
    border: "var(--eduflow-danger-200)",
  },
  HIGH: {
    bg: "var(--eduflow-warning-50, #fff7ed)",
    color: "var(--eduflow-warning-800, #9a3412)",
    border: "var(--eduflow-warning-200, #fed7aa)",
  },
  MEDIUM: {
    bg: "var(--brand-50)",
    color: "var(--brand-800)",
    border: "var(--brand-100)",
  },
  LOW: {
    bg: "var(--eduflow-success-50)",
    color: "var(--eduflow-success-800)",
    border: "var(--eduflow-success-200)",
  },
};

function formatSeries(code: string) {
  return code.replace(/^SERIE_/i, "Série ").replace(/_/g, " ");
}

export function StudentRiskCard({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<InterventionPlan | null>(null);

  const analyze = async () => {
    setLoading(true);
    try {
      const result = await callGovernanceAction<InterventionPlan>("analyze-risk", {
        studentId,
      });
      if (result.data) {
        setPlan(result.data);
        toast.success("Analyse de risque terminée");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyse indisponible");
    } finally {
      setLoading(false);
    }
  };

  const priorityStyle = plan ? PRIORITY_STYLES[plan.priority] ?? PRIORITY_STYLES.MEDIUM : null;

  return (
    <Card padding={0}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--eduflow-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--eduflow-danger-50)",
            }}
          >
            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
          </div>
          <div>
            <h3
              className="eduflow-display"
              style={{ fontSize: 16, margin: 0, color: "var(--eduflow-text-primary)" }}
            >
              Élève à risque
            </h3>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                color: "var(--eduflow-text-secondary)",
              }}
            >
              Analyse prédictive et synthèse des facteurs de décrochage
            </p>
          </div>
        </div>
        <Button
          variant="soft"
          size="sm"
          icon="sparkle"
          loading={loading}
          disabled={loading}
          onClick={analyze}
        >
          Analyser le risque
        </Button>
      </div>

      <div className="px-5 py-4">
        {!plan ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--eduflow-text-tertiary)",
              lineHeight: 1.55,
            }}
          >
            Lancez l&apos;analyse pour obtenir un profil de risque personnalisé et des
            recommandations immédiates — sans clé cloud externe.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: priorityStyle?.bg,
                  color: priorityStyle?.color,
                  border: priorityStyle ? `1px solid ${priorityStyle.border}` : undefined,
                }}
              >
                Priorité {plan.priority}
              </span>
              <Badge variant="neutral" size="sm">
                Score {Math.round(plan.riskScore)} %
              </Badge>
              <Badge variant="neutral" size="sm">
                Niveau {plan.riskLevel}
              </Badge>
            </div>

            {plan.summary ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--eduflow-text-primary)",
                }}
              >
                {plan.summary}
              </p>
            ) : null}

            {plan.factors.length > 0 ? (
              <div>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--eduflow-text-tertiary)",
                  }}
                >
                  Facteurs identifiés
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {plan.factors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.recommendations.length > 0 ? (
              <div>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--eduflow-text-tertiary)",
                  }}
                >
                  Recommandations
                </p>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 13,
                    color: "var(--eduflow-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {plan.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

export function StudentOrientationAction({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    series: string;
    justification: string;
    alternatives?: string[];
    synthesis?: string;
  } | null>(null);

  const propose = async () => {
    setLoading(true);
    try {
      const res = await callGovernanceAction<{
        series: string;
        justification: string;
        alternatives?: string[];
        synthesis?: string;
      }>("recommend-orientation", { studentId });
      if (res.data) {
        setResult(res.data);
        toast.success("Orientation proposée");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Orientation indisponible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding={0}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--eduflow-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--brand-50)",
            }}
          >
            <Icon name="school" size={18} color="var(--brand-700)" />
          </div>
          <div>
            <h3
              className="eduflow-display"
              style={{ fontSize: 16, margin: 0, color: "var(--eduflow-text-primary)" }}
            >
              Proposer une orientation
            </h3>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                color: "var(--eduflow-text-secondary)",
              }}
            >
              Recommandation de série post-BEPC selon le profil académique
            </p>
          </div>
        </div>
        <Button
          variant="soft"
          size="sm"
          icon="sparkle"
          loading={loading}
          disabled={loading}
          onClick={propose}
        >
          Proposer une orientation
        </Button>
      </div>

      <div className="px-5 py-4">
        {!result ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--eduflow-text-tertiary)",
              lineHeight: 1.55,
            }}
          >
            Génère une synthèse d&apos;orientation basée sur les notes et matières fortes de
            l&apos;élève.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--brand-50)",
                border: "1px solid var(--brand-100)",
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--brand-700)",
                }}
              >
                Série recommandée
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--brand-900)",
                }}
              >
                {formatSeries(result.series)}
              </p>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--eduflow-text-primary)",
              }}
            >
              {result.justification}
            </p>
            {result.alternatives && result.alternatives.length > 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--eduflow-text-secondary)",
                }}
              >
                Alternatives :{" "}
                {result.alternatives.map((s) => formatSeries(s)).join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

export function StudentInterventionPlan({ studentId }: { studentId: string }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{
    title: string;
    description: string;
    priority: string;
    steps: string[];
  } | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await callGovernanceAction<{
        title: string;
        description: string;
        priority: string;
        steps: string[];
      }>("generate-action-plan", { studentId });
      if (res.data) {
        setPlan(res.data);
        toast.success("Plan d'intervention généré");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération indisponible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding={0}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--eduflow-border-subtle)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--eduflow-success-50)",
            }}
          >
            <Icon name="check" size={18} color="var(--eduflow-success-700)" />
          </div>
          <div>
            <h3
              className="eduflow-display"
              style={{ fontSize: 16, margin: 0, color: "var(--eduflow-text-primary)" }}
            >
              Plan d&apos;intervention
            </h3>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                color: "var(--eduflow-text-secondary)",
              }}
            >
              Actions concrètes de remédiation et de suivi personnalisé
            </p>
          </div>
        </div>
        <Button
          variant="soft"
          size="sm"
          icon="sparkle"
          loading={loading}
          disabled={loading}
          onClick={generate}
        >
          Générer le plan
        </Button>
      </div>

      <div className="px-5 py-4">
        {!plan ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--eduflow-text-tertiary)",
              lineHeight: 1.55,
            }}
          >
            Crée un plan d&apos;action pédagogique adapté aux forces et faiblesses de
            l&apos;élève.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--eduflow-text-primary)",
                }}
              >
                {plan.title}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--eduflow-text-secondary)",
                }}
              >
                {plan.description}
              </p>
            </div>
            {plan.steps.length > 0 ? (
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 13,
                  color: "var(--eduflow-text-primary)",
                  lineHeight: 1.6,
                }}
              >
                {plan.steps.map((step, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
