"use client";

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
    MetricCard,
    NotifItem,
    Progress,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";
import { PaymentBarChart } from "@/components/charts/PaymentBarChart";
import { BasePieChart } from "@/components/charts/BasePieChart";
import { CHART_COLORS } from "@/components/charts/chart-theme";

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

const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat("fr-BJ", {
        style: "currency",
        currency: "XOF",
        maximumFractionDigits: 0,
    }).format(amount);

export default function FinanceDashboardPage() {
    const { data: session } = useSession();
    const { schoolId } = useSchool();
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

    const barChartData = useMemo(() => {
        if (!dashData?.paymentsTrend) return [];
        const byMonth: Record<string, { received: number; pending: number }> = {};
        for (const t of dashData.paymentsTrend) {
            const month = new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
                new Date(t.date)
            );
            if (!byMonth[month]) byMonth[month] = { received: 0, pending: 0 };
            byMonth[month].received += t.amount;
        }
        const months = Object.keys(byMonth);
        if (months.length > 0 && dashData.summary.totalPending > 0) {
            const pendingPerMonth = dashData.summary.totalPending / months.length;
            for (const m of months) byMonth[m].pending = Math.round(pendingPerMonth);
        }
        return months.map((m) => ({
            month: m,
            received: byMonth[m].received,
            pending: byMonth[m].pending,
        }));
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
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Finances"
                    sub="Suivi des encaissements, impayés et santé financière de l'établissement."
                    breadcrumb={["Tableau de bord", "Finances"]}
                    actions={
                        <RoleActionGuard
                            allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"]}
                        >
                            <div className="flex flex-wrap gap-2">
                                <Link href="/dashboard/finance/bulk-invoice">
                                    <Button variant="secondary" icon="sparkle">
                                        Facturation de masse
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
                    <Card padding={16} style={{ borderLeft: "3px solid var(--eduflow-danger-500)" }}>
                        <div className="flex items-start gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    Erreur de chargement
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        marginTop: 2,
                                    }}
                                >
                                    Impossible de récupérer les indicateurs financiers.
                                </div>
                            </div>
                        </div>
                    </Card>
                ) : null}

                {/* KPI strip */}
                {dashLoading ? (
                    <KpiSkeleton />
                ) : dashData ? (
                    <>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: 12,
                            }}
                        >
                            <MetricCard
                                label="Total attendu"
                                value={formatCurrency(dashData.summary.totalFees)}
                                icon="money"
                                variant="neutral"
                            />
                            <MetricCard
                                label="Total encaissé"
                                value={formatCurrency(dashData.summary.totalCollected)}
                                trend={dashData.summary.collectionRate}
                                trendLabel="taux collecté"
                                icon="check"
                                variant="success"
                            />
                            <MetricCard
                                label="Reste à recouvrer"
                                value={formatCurrency(dashData.summary.totalPending)}
                                icon="warning"
                                variant="warning"
                            />
                            <MetricCard
                                label="Recouvrement"
                                value={`${dashData.summary.collectionRate.toFixed(1).replace(".", ",")}`}
                                unit="%"
                                icon="chart"
                                variant="brand"
                            />
                        </div>

                        {/* Charts */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                                gap: 16,
                            }}
                            className="dashboard-grid-collapse"
                        >
                            <Card padding={20}>
                                <div className="mb-4 flex items-start justify-between">
                                    <div>
                                        <h2
                                            className="eduflow-display"
                                            style={{ fontSize: 18, margin: 0 }}
                                        >
                                            Évolution des encaissements
                                        </h2>
                                        <p
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-tertiary)",
                                                margin: "4px 0 0",
                                            }}
                                        >
                                            Reçu vs en attente · {periods.length || "période en cours"}
                                        </p>
                                    </div>
                                    <Badge variant="brand" size="sm">
                                        {dashData.summary.collectionRate.toFixed(0)}% collecté
                                    </Badge>
                                </div>
                                <div style={{ height: 280 }}>
                                    <PaymentBarChart data={barChartData} />
                                </div>
                            </Card>
                            <Card padding={20}>
                                <SubLabel>Répartition</SubLabel>
                                <div style={{ height: 220 }}>
                                    <BasePieChart
                                        data={collectionPieData}
                                        height="100%"
                                        cx="50%"
                                        cy="50%"
                                        paddingAngle={5}
                                    />
                                </div>
                                <Progress
                                    value={dashData.summary.collectionRate}
                                    label="Progression"
                                    sublabel={`${dashData.summary.collectionRate.toFixed(1).replace(".", ",")}%`}
                                    variant="success"
                                />
                            </Card>
                        </div>

                        {/* Recent + overdue */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                                gap: 16,
                            }}
                            className="dashboard-grid-collapse"
                        >
                            <Card padding={0}>
                                <div
                                    className="flex items-center justify-between border-b px-5 py-4"
                                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                                >
                                    <div>
                                        <h2
                                            className="eduflow-display"
                                            style={{ fontSize: 18, margin: 0 }}
                                        >
                                            Derniers paiements
                                        </h2>
                                        <p
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                margin: "2px 0 0",
                                            }}
                                        >
                                            {dashData.recentPayments.length} encaissements récents
                                        </p>
                                    </div>
                                    <Link
                                        href="/dashboard/finance/payments"
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            letterSpacing: "0.06em",
                                            textTransform: "uppercase",
                                            color: "var(--brand-700)",
                                            textDecoration: "none",
                                        }}
                                    >
                                        Voir tout
                                    </Link>
                                </div>
                                {dashData.recentPayments.length === 0 ? (
                                    <EmptyRow
                                        title="Aucun paiement récent"
                                        body="Les nouveaux encaissements apparaîtront ici."
                                    />
                                ) : (
                                    dashData.recentPayments.slice(0, 6).map((p, i) => (
                                        <div
                                            key={p.id}
                                            className="grid items-center gap-3 px-5 py-3"
                                            style={{
                                                gridTemplateColumns: "minmax(0, 1fr) auto auto",
                                                borderTop:
                                                    i > 0
                                                        ? "1px solid var(--eduflow-border-subtle)"
                                                        : "none",
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <Avatar
                                                    name={`${p.student.user.firstName} ${p.student.user.lastName}`}
                                                    size="sm"
                                                />
                                                <div className="min-w-0">
                                                    <div
                                                        className="truncate"
                                                        style={{ fontSize: 13, fontWeight: 600 }}
                                                    >
                                                        {p.student.user.firstName}{" "}
                                                        {p.student.user.lastName}
                                                    </div>
                                                    <div
                                                        className="truncate"
                                                        style={{
                                                            fontSize: 11,
                                                            color: "var(--eduflow-text-tertiary)",
                                                        }}
                                                    >
                                                        {p.fee.name}
                                                    </div>
                                                </div>
                                            </div>
                                            <span
                                                className="eduflow-display eduflow-tabular"
                                                style={{
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    color: "var(--eduflow-success-700)",
                                                }}
                                            >
                                                {formatCurrency(p.amount)}
                                            </span>
                                            <Badge variant="success" size="sm" icon="check">
                                                Validé
                                            </Badge>
                                        </div>
                                    ))
                                )}
                            </Card>

                            <Card padding={0}>
                                <div
                                    className="flex items-center justify-between border-b px-5 py-4"
                                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon
                                            name="warning"
                                            size={18}
                                            color="var(--eduflow-danger-600)"
                                        />
                                        <h2
                                            className="eduflow-display"
                                            style={{ fontSize: 18, margin: 0 }}
                                        >
                                            Alertes impayés
                                        </h2>
                                    </div>
                                    {dashData.overdueStudents.length > 0 ? (
                                        <Badge variant="danger" size="sm">
                                            {dashData.overdueStudents.length}
                                        </Badge>
                                    ) : null}
                                </div>
                                {dashData.overdueStudents.length === 0 ? (
                                    <EmptyRow
                                        title="Aucune alerte critique"
                                        body="Tous les paiements sont à jour."
                                    />
                                ) : (
                                    <div style={{ padding: "8px" }}>
                                        {dashData.overdueStudents.slice(0, 6).map((s) => (
                                            <NotifItem
                                                key={s.studentId}
                                                type="urgent"
                                                priority={s.balance > 100000 ? "P0" : "P1"}
                                                title={s.studentName}
                                                body={`Solde dû : ${formatCurrency(s.balance)}`}
                                                time="à relancer"
                                                actions={["Contacter", "SMS"]}
                                            />
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </div>

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
                                            style={{ fontSize: 18, margin: 0 }}
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
                                                                fontSize: 10,
                                                                fontWeight: 700,
                                                                letterSpacing: "0.06em",
                                                                textTransform: "uppercase",
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
            </div>
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
            className="flex h-9 items-center gap-2 rounded-md px-3"
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

function KpiSkeleton() {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
            }}
        >
            {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                    <div
                        style={{
                            height: 70,
                            background: "var(--eduflow-surface-sunken)",
                            borderRadius: 8,
                        }}
                    />
                </Card>
            ))}
        </div>
    );
}
