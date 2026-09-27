"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageError, PageLoading } from "@/components/layout/page-states";
import { Block, CARD_COLORS, Empty, Figures, MODULE, initials } from "@/components/edu-homes/home-kit";
import homeStyles from "@/components/edu-homes/home.module.css";

interface ParentPayment {
    id: string;
    feeName: string;
    amount: number;
    date: string;
    method: string;
}

interface ParentFinanceData {
    totalPending: number;
    totalPaid: number;
    nextDueDate?: string | null;
    payments?: ParentPayment[];
}

export function ParentFinanceView() {
    const { data, error, isLoading, mutate } = useSWR<ParentFinanceData>("/api/finance/my-payments", fetcher);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("fr-BJ", {
            style: "currency",
            currency: "XOF",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const generateReceipt = async (payment: ParentPayment) => {
        const { jsPDF } = await import("jspdf");
        // API fonctionnelle d'autotable v5 : typée, sans patch du prototype jsPDF
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text("REÇU DE PAIEMENT", 105, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.text("EduPilot School Management System", 105, 30, { align: "center" });
        
        // Divider
        doc.setLineWidth(0.5);
        doc.line(20, 35, 190, 35);
        
        // Details
        doc.setFontSize(12);
        doc.text(`Référence: REC-${payment.id.substring(0, 8).toUpperCase()}`, 20, 50);
        doc.text(`Date: ${new Date(payment.date).toLocaleDateString("fr-FR")}`, 20, 60);
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Détails du paiement", 20, 80);
        
        const tableData = [
            ["Libellé", payment.feeName],
            ["Montant", formatCurrency(payment.amount)],
            ["Mode de paiement", payment.method],
            ["Statut", "Validé / Payé"]
        ];
        
        autoTable(doc, {
            startY: 85,
            head: [["Description", "Informations"]],
            body: tableData,
            theme: "striped",
            headStyles: { fillColor: [79, 70, 229] }
        });

        // Footer — lastAutoTable est posé par autotable sur l'instance jsPDF
        const finalY =
            (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 150;
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Ce document tient lieu de preuve de paiement officielle.", 105, finalY + 20, { align: "center" });
        
        doc.save(`Recu_${payment.id.substring(0, 8)}.pdf`);
    };

    if (error) return <PageError message="Impossible de charger vos paiements." onRetry={() => void mutate()} />;
    if (isLoading) return <PageLoading label="Chargement des paiements…" />;

    const payments = data?.payments ?? [];
    const due = data?.nextDueDate ? new Date(data.nextDueDate) : null;
    const overdue = due !== null && due.getTime() < Date.now() && (data?.totalPending ?? 0) > 0;
    const dueLabel = due ? due.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;

    return (
        <PageShell>
            <PageHeader
                title="Scolarité et paiements"
                description="Ce qui reste à régler pour vos enfants et les paiements déjà validés."
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Scolarité et paiements" },
                ]}
            />

            <Block id="parent-finance-overview" title="Vue d'ensemble">
                <Figures
                    items={[
                        {
                            label: "Reste à régler",
                            value: formatCurrency(data?.totalPending || 0),
                            note: (data?.totalPending ?? 0) > 0 ? "frais de scolarité en attente" : "tout est réglé",
                            color: (data?.totalPending ?? 0) > 0 ? MODULE.orange : MODULE.green,
                        },
                        {
                            label: "Déjà réglé",
                            value: formatCurrency(data?.totalPaid || 0),
                            note: `${payments.length} paiement${payments.length > 1 ? "s" : ""} validé${payments.length > 1 ? "s" : ""}`,
                            color: MODULE.green,
                        },
                        {
                            label: overdue ? "En retard depuis" : "Prochaine échéance",
                            value: dueLabel ?? "Aucune",
                            note: overdue ? "à régler auprès de l'économat" : due ? "date limite de paiement" : "aucune échéance prévue",
                            color: overdue ? MODULE.pink : MODULE.blue,
                        },
                    ]}
                />
            </Block>

            <Block id="parent-finance-history" title="Historique des paiements">
                {payments.length === 0 ? (
                    <Empty>Aucun paiement enregistré.</Empty>
                ) : (
                    <ul className={homeStyles.watch}>
                        {payments.map((payment, i) => (
                            <li key={payment.id} className={homeStyles.watchItem}>
                                <span className={homeStyles.avatar} style={{ background: CARD_COLORS[i % CARD_COLORS.length] }} aria-hidden="true">
                                    {initials(payment.feeName)}
                                </span>
                                <div className="min-w-0">
                                    <div className={homeStyles.name}>
                                        {payment.feeName} · {formatCurrency(payment.amount)}
                                    </div>
                                    <div className={homeStyles.detail}>
                                        {new Date(payment.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
                                        {payment.method}
                                    </div>
                                </div>
                                <button type="button" className={homeStyles.pill} onClick={() => void generateReceipt(payment)}>
                                    Reçu
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Block>
        </PageShell>
    );
}
