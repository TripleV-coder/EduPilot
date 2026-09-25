"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { useSchool } from "@/components/providers/school-provider";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { ParentFinanceView } from "@/components/dashboard/finance/parent-finance-view";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    FilterBar,
    Icon,
    Progress,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Block, Empty, Figures, MODULE, Row, WatchList, decimal, initials } from "@/components/edu-homes/home-kit";
import { PageError, PageLoading } from "@/components/layout/page-states";


import { CHART_COLORS } from "@/components/charts/chart-theme";

// Perf : les graphiques embarquent recharts (~350 Ko). Chargés à la demande,
// dans un conteneur dont la hauteur est déjà réservée — aucun décalage.
const PaymentBarChart = dynamic(() => import("@/components/charts/PaymentBarChart").then((m) => m.PaymentBarChart), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});
const BasePieChart = dynamic(() => import("@/components/charts/BasePieChart").then((m) => m.BasePieChart), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

type FinanceSummary = {
    totalFees: number;
    totalCollected: number;
    totalPending: number;
    collectionRate: number;
};

type Payment = {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    student: { user: { firstName: string; lastName: string } };
    fee: { name: string };
};

type OverdueStudent = {
    studentId: string;
    studentName: string;
    balance: number;
};

type PaymentTrend = { date: string; amount: number; count: number };

type PaymentPlan = {
    id: string;
    totalAmount: number;
    paidAmount: number;
    installments: number;
    status: string;
    student: { user: { firstName: string; lastName: string } };
    fee: { name: string };
    installmentPayments: {
        id: string;
        amount: number;
        dueDate: string;
        status: string;
    }[];
};

type FinanceDashboardData = {
    summary: FinanceSummary;
    recentPayments: Payment[];
    overdueStudents: OverdueStudent[];
    paymentsTrend: PaymentTrend[];
};

type AcademicYear = { id: string; name: string; periods?: { id: string; name: string }[] };

// fr-FR garantit le groupement par milliers (153 885 000) ; fr-BJ n'est pas
// toujours présent dans l'ICU runtime et retombe sans séparateurs. Suffixe
// FCFA manuel pour rester cohérent avec le reste de l'app.
const FR_NUM = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const formatCurrency = (amount: number): string => `${FR_NUM.format(amount)} FCFA`;

const PAYMENT_STATUS: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
    VERIFIED: { label: "Validé", variant: "success" },
    RECONCILED: { label: "Rapproché", variant: "success" },
    PENDING: { label: "À valider", variant: "warning" },
    CANCELLED: { label: "Annulé", variant: "neutral" },
};

export default function FinanceDashboardPage() {
    const { data: session } = useSession();
    const { schoolId: activeSchoolId } = useSchool();
    // Le parent a sa propre vue (ParentFinanceView) : aucune requête du tableau
    // de bord de l'établissement ne doit partir pour lui (403 à chaque visite).
    const isParent = session?.user?.role === "PARENT";
    const schoolId = isParent ? null : activeSchoolId;
    const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("ALL");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("ALL");
    const [payingInstallment, setPayingInstallment] = useState<string | null>(null);

    const { data: academicYears } = useSWR<AcademicYear[]>(
        schoolId ? `/api/academic-years?schoolId=${schoolId}` : null,
        fetcher
    );

    const activeYear = useMemo(
        () =>
            Array.isArray(academicYears)
                ? academicYears.find((y) => y.id === selectedAcademicYearId)
                : null,
        [academicYears, selectedAcademicYearId]
    );
    const periods = activeYear?.periods || [];

    const dashboardQuery = useMemo(() => {
        const params = new URLSearchParams();
        if (schoolId) params.set("schoolId", schoolId);
        if (selectedAcademicYearId !== "ALL") params.set("academicYearId", selectedAcademicYearId);
        if (selectedPeriodId !== "ALL") params.set("periodId", selectedPeriodId);
        return params.toString();
    }, [schoolId, selectedAcademicYearId, selectedPeriodId]);

    const {
        data: dashData,
        error: dashError,
        isLoading: dashLoading,
        mutate: mutateDash,
    } = useSWR<FinanceDashboardData>(
        schoolId ? `/api/finance/dashboard?${dashboardQuery}` : null,
        fetcher
    );

    const { data: paymentPlans, mutate: mutatePlans } = useSWR<PaymentPlan[]>(
        schoolId ? `/api/payment-plans?schoolId=${schoolId}` : null,
        fetcher
    );

    const handlePayInstallment = async (planId: string, installmentId: string) => {
        setPayingInstallment(installmentId);
        try {
            const res = await fetch(
                `/api/payment-plans/${planId}/installments/${installmentId}/pay`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ method: "CASH" }),
                }
            );
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Erreur lors du paiement");
                return;
            }
            toast.success("Paiement enregistré");
            await Promise.all([mutateDash(), mutatePlans()]);
        } catch {
            toast.error("Erreur réseau");
        } finally {
            setPayingInstallment(null);
        }
    };

    // Encaissements validés réellement reçus, par jour sur une fenêtre courte,
    // par mois au-delà. Aucune série « en attente » : l'API ne la date pas, et la
    // répartir uniformément sur les mois inventait des montants.
    const barChartData = useMemo(() => {
        const trend = dashData?.paymentsTrend ?? [];
        if (trend.length === 0) return [];
        const first = new Date(trend[0].date).getTime();
        const last = new Date(trend[trend.length - 1].date).getTime();
        const daily = last - first <= 45 * 24 * 60 * 60 * 1000;
        const fmt = new Intl.DateTimeFormat(
            "fr-FR",
            daily ? { day: "numeric", month: "short" } : { month: "short", year: "2-digit" }
        );
        const buckets = new Map<string, number>();
        for (const t of trend) {
            const key = fmt.format(new Date(t.date));
            buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
        }
        return [...buckets].map(([month, received]) => ({ month, received }));
    }, [dashData]);

    const collectionPieData = useMemo(() => {
        if (!dashData?.summary) return [];
        return [
            { name: "Collecté", value: dashData.summary.totalCollected, color: CHART_COLORS.excellent },
            {
                name: "Reste à recouvrer",
                value: dashData.summary.totalPending,
                color: CHART_COLORS.average,
            },
        ];
    }, [dashData]);

    if (session?.user?.role === "PARENT") return <ParentFinanceView />;

    return (
        <PageGuard
            permission={[Permission.FINANCE_READ]}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}
        >
            <PageShell>
                <PageHeader
                    title="Finances"
                    description="Suivi des encaissements, impayés et santé financière de l'établissement."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finances" },
                    ]}
                    actions={
                        <RoleActionGuard
                            allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"]}
                        >
                            <div className="flex flex-wrap gap-2">
                                <Link href="/dashboard/finance/bulk-invoice">
                                    <Button variant="secondary" icon="sparkle">
                                        Avis de paiement
                                    </Button>
                                </Link>
                                <Link href="/dashboard/finance/payments/new">
                                    <Button icon="plus">Nouvel encaissement</Button>
                                </Link>
                            </div>
                        </RoleActionGuard>
                    }
                />

                {/* Filtres */}
                <FilterBar>
                    <FilterPill
                        value={selectedAcademicYearId}
                        onChange={(v) => {
                            setSelectedAcademicYearId(v);
                            setSelectedPeriodId("ALL");
                        }}
                        options={[
                            { value: "ALL", label: "Toutes les années" },
                            ...(academicYears ?? []).map((y) => ({ value: y.id, label: y.name })),
                        ]}
                        label="Année"
                    />
                    <FilterPill
                        value={selectedPeriodId}
                        onChange={setSelectedPeriodId}
                        disabled={selectedAcademicYearId === "ALL" || periods.length === 0}
                        options={[
                            { value: "ALL", label: "Toute l'année" },
                            ...periods.map((p) => ({ value: p.id, label: p.name })),
                        ]}
                        label="Période"
                    />
                </FilterBar>

                {dashError ? (
                    <PageError
                        message="Impossible de récupérer les indicateurs financiers."
                        onRetry={() => void mutateDash()}
                    />
                ) : null}

                {dashLoading ? <PageLoading label="Chargement des indicateurs financiers…" /> : null}

                {/* Vue d'ensemble — mêmes blocs que l'accueil direction */}
                {!dashLoading && dashData ? (
                    <>
                        <Block id="fin-overview" title="Vue d'ensemble">
                            <Figures
                                items={[
                                    {
                                        label: "Total attendu",
                                        value: formatCurrency(dashData.summary.totalFees),
                                        note: "Frais facturés et échéanciers",
                                        color: MODULE.blue,
                                    },
                                    {
                                        label: "Encaissé",
                                        value: formatCurrency(dashData.summary.totalCollected),
                                        note: "Paiements validés",
                                        color: MODULE.green,
                                    },
                                    {
                                        label: "Reste à recouvrer",
                                        value: formatCurrency(dashData.summary.totalPending),
                                        note: overdueNote(dashData.overdueStudents.length),
                                        color: MODULE.orange,
                                    },
                                    {
                                        label: "Recouvrement",
                                        value: `${decimal(dashData.summary.collectionRate)} %`,
                                        note: "Encaissé ÷ attendu",
                                        color: MODULE.purple,
                                    },
                                ]}
                            />
                        </Block>

                        <Row>
                            <Block id="fin-trend" title="Évolution des encaissements">
                                <p className="-mt-2 mb-3 text-[13px] text-muted-foreground">
                                    Paiements validés ·{" "}
                                    {selectedPeriodId !== "ALL"
                                        ? periods.find((p) => p.id === selectedPeriodId)?.name ?? "période choisie"
                                        : "30 derniers jours"}
                                </p>
                                <PaymentBarChart data={barChartData} height={240} />
                            </Block>
                            <Block id="fin-split" title="Répartition">
                                {dashData.summary.totalFees > 0 ? (
                                    <>
                                        <div style={{ height: 200 }}>
                                            <BasePieChart
                                                data={collectionPieData}
                                                height="100%"
                                                cx="50%"
                                                cy="50%"
                                                paddingAngle={5}
                                            />
                                        </div>
                                        <Progress
                                            value={Math.min(100, dashData.summary.collectionRate)}
                                            label="Recouvrement"
                                            sublabel={`${decimal(dashData.summary.collectionRate)} %`}
                                            variant="success"
                                        />
                                    </>
                                ) : (
                                    <Empty>Aucun frais facturé sur cette sélection.</Empty>
                                )}
                            </Block>
                        </Row>

                        <Row>
                            <Block id="fin-recent" title="Derniers paiements">
                                {dashData.recentPayments.length === 0 ? (
                                    <Empty>Aucun paiement récent. Les nouveaux encaissements apparaîtront ici.</Empty>
                                ) : (
                                    <ul className="m-0 list-none p-0">
                                        {dashData.recentPayments.slice(0, 6).map((p, i) => {
                                            const status = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PENDING;
                                            return (
                                                <li
                                                    key={p.id}
                                                    className="grid items-center gap-3 py-2.5"
                                                    style={{
                                                        gridTemplateColumns: "minmax(0, 1fr) auto auto",
                                                        borderTop: i > 0 ? "1px solid var(--eduflow-border-subtle)" : "none",
                                                    }}
                                                >
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <Avatar
                                                            name={`${p.student.user.firstName} ${p.student.user.lastName}`}
                                                            size="sm"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold">
                                                                {p.student.user.firstName} {p.student.user.lastName}
                                                            </div>
                                                            <div className="truncate text-[13px] text-muted-foreground">
                                                                {p.fee.name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="eduflow-tabular text-sm font-semibold">
                                                        {formatCurrency(p.amount)}
                                                    </span>
                                                    <Badge variant={status.variant} size="sm">
                                                        {status.label}
                                                    </Badge>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </Block>
                            <Block id="fin-overdue" title="Impayés à relancer">
                                <WatchList
                                    calm="Aucun impayé en retard : tous les paiements échus sont à jour."
                                    items={dashData.overdueStudents.slice(0, 6).map((s) => ({
                                        key: s.studentId,
                                        avatar: initials(s.studentName),
                                        color: s.balance > 100000 ? MODULE.pink : MODULE.orange,
                                        name: s.studentName,
                                        detail: `Solde dû : ${formatCurrency(s.balance)}`,
                                        action: { href: `/dashboard/students/${s.studentId}`, label: "Voir le dossier" },
                                    }))}
                                />
                            </Block>
                        </Row>

                        {/* Payment plans */}
                        <Card padding={0}>
                            <div
                                className="flex items-center justify-between border-b px-5 py-4"
                                style={{ borderColor: "var(--eduflow-border-subtle)" }}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon name="calendar" size={18} color="var(--brand-700)" />
                                    <div>
                                        <h2
                                            className="eduflow-display"
                                            style={{ fontSize: 16, margin: 0 }}
                                        >
                                            Échéanciers actifs
                                        </h2>
                                        <p
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                margin: "2px 0 0",
                                            }}
                                        >
                                            Plans de paiement et progression des encaissements
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="brand" size="sm">
                                    {paymentPlans?.length ?? 0} actifs
                                </Badge>
                            </div>

                            {!paymentPlans || paymentPlans.length === 0 ? (
                                <EmptyRow
                                    title="Aucun échéancier actif"
                                    body="Les nouveaux plans de paiement apparaîtront ici."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            fontSize: 13,
                                        }}
                                    >
                                        <thead>
                                            <tr
                                                style={{
                                                    background: "var(--eduflow-surface-sunken)",
                                                    textAlign: "left",
                                                }}
                                            >
                                                {["Élève", "Total", "Payé", "Échéances", "Statut", ""].map(
                                                    (h) => (
                                                        <th
                                                            key={h}
                                                            style={{
                                                                padding: "10px 16px",
                                                                fontSize: 11,
                                                                fontWeight: 700,
                                                                color: "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            {h}
                                                        </th>
                                                    )
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentPlans.map((plan) => {
                                                const paidCount = plan.installmentPayments.filter(
                                                    (i) => i.status === "PAID"
                                                ).length;
                                                const ratio = (paidCount / plan.installments) * 100;
                                                const next = plan.installmentPayments.find(
                                                    (i) => i.status === "PENDING"
                                                );
                                                return (
                                                    <tr
                                                        key={plan.id}
                                                        style={{
                                                            borderTop:
                                                                "1px solid var(--eduflow-border-subtle)",
                                                        }}
                                                    >
                                                        <td
                                                            style={{
                                                                padding: "12px 16px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 10,
                                                            }}
                                                        >
                                                            <Avatar
                                                                name={`${plan.student.user.firstName} ${plan.student.user.lastName}`}
                                                                size="sm"
                                                            />
                                                            <div>
                                                                <div
                                                                    style={{ fontSize: 13, fontWeight: 600 }}
                                                                >
                                                                    {plan.student.user.firstName}{" "}
                                                                    {plan.student.user.lastName}
                                                                </div>
                                                                <div
                                                                    style={{
                                                                        fontSize: 11,
                                                                        color: "var(--eduflow-text-tertiary)",
                                                                    }}
                                                                >
                                                                    {plan.fee.name}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 16px",
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                            }}
                                                            className="eduflow-tabular"
                                                        >
                                                            {formatCurrency(plan.totalAmount)}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 16px",
                                                                fontSize: 13,
                                                                fontWeight: 700,
                                                                color: "var(--eduflow-success-700)",
                                                            }}
                                                            className="eduflow-tabular"
                                                        >
                                                            {formatCurrency(plan.paidAmount)}
                                                        </td>
                                                        <td
                                                            style={{
                                                                padding: "12px 16px",
                                                                minWidth: 140,
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div
                                                                    style={{
                                                                        height: 4,
                                                                        flex: 1,
                                                                        background:
                                                                            "var(--eduflow-neutral-200)",
                                                                        borderRadius: 2,
                                                                        overflow: "hidden",
                                                                    }}
                                                                >
                                                                    <div
                                                                        style={{
                                                                            height: "100%",
                                                                            width: `${ratio}%`,
                                                                            background:
                                                                                ratio === 100
                                                                                    ? "var(--eduflow-success-500)"
                                                                                    : "var(--brand-600)",
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span
                                                                    className="eduflow-tabular"
                                                                    style={{
                                                                        fontSize: 11,
                                                                        fontWeight: 600,
                                                                        color: "var(--eduflow-text-secondary)",
                                                                    }}
                                                                >
                                                                    {paidCount}/{plan.installments}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: "12px 16px" }}>
                                                            {plan.status === "COMPLETED" ? (
                                                                <Badge variant="success" size="sm" icon="check">
                                                                    Terminé
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="brand" size="sm" dot>
                                                                    En cours
                                                                </Badge>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: "10px 16px" }}>
                                                            {next ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    icon={
                                                                        payingInstallment === next.id
                                                                            ? undefined
                                                                            : "money"
                                                                    }
                                                                    loading={payingInstallment === next.id}
                                                                    onClick={() =>
                                                                        handlePayInstallment(plan.id, next.id)
                                                                    }
                                                                >
                                                                    Encaisser
                                                                </Button>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}

function FilterPill({
    value,
    onChange,
    options,
    label,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    label: string;
    disabled?: boolean;
}) {
    return (
        <label
            className="flex h-9 items-center gap-2 rounded-full px-4"
            style={{
                background: "var(--eduflow-surface-card)",
                border: "1px solid var(--eduflow-border-default)",
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
            }}
        >
            <span
                style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {label}
            </span>
            <select
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="bg-transparent outline-none"
                style={{
                    border: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--eduflow-text-primary)",
                    fontFamily: "inherit",
                    cursor: disabled ? "not-allowed" : "pointer",
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

function EmptyRow({ title, body }: { title: string; body: string }) {
    return (
        <div
            className="flex items-start gap-3 px-5 py-6"
            style={{ fontSize: 12, color: "var(--eduflow-text-secondary)", lineHeight: 1.5 }}
        >
            <Icon name="info" size={16} color="var(--brand-700)" />
            <div>
                <div style={{ fontWeight: 600, color: "var(--eduflow-text-primary)", fontSize: 13 }}>
                    {title}
                </div>
                <div>{body}</div>
            </div>
        </div>
    );
}

/** L'API plafonne la liste des retards à 10 élèves : au-delà, on ne prétend pas au chiffre exact. */
function overdueNote(count: number): string {
    if (count === 0) return "Aucun frais échu impayé";
    if (count >= 10) return "10 élèves ou plus en retard";
    return `${count} élève${count > 1 ? "s" : ""} en retard`;
}
