"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DollarSign, AlertCircle, CreditCard, Clock, CheckCircle, Printer } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Button } from "@/components/ui/button";

export function ParentFinanceView() {
    const { data, error, isLoading } = useSWR<any>("/api/finance/my-payments", fetcher);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("fr-BJ", {
            style: "currency",
            currency: "XOF",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const generateReceipt = (payment: any) => {
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
        
        (doc as any).autoTable({
            startY: 85,
            head: [["Description", "Informations"]],
            body: tableData,
            theme: "striped",
            headStyles: { fillColor: [79, 70, 229] }
        });
        
        // Footer
        const finalY = (doc as any).lastAutoTable.finalY || 150;
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Ce document tient lieu de preuve de paiement officielle.", 105, finalY + 20, { align: "center" });
        
        doc.save(`Recu_${payment.id.substring(0, 8)}.pdf`);
    };

    if (error) return <div className="p-4 text-destructive">Erreur de chargement des données financières</div>;
    if (isLoading) return <div className="p-8 text-center">Chargement...</div>;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Scolarité & Paiements"
                description="Suivez l'état des paiements pour vos enfants"
                breadcrumbs={[
                    { label: "Tableau de bord", href: "/dashboard" },
                    { label: "Mes Paiements" },
                ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total à régler</CardTitle>
                        <DollarSign className="w-4 h-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data?.totalPending || 0)}</div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Déjà réglé</CardTitle>
                        <CheckCircle className="w-4 h-4 text-secondary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(data?.totalPaid || 0)}</div>
                    </CardContent>
                </Card>
                <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Prochaine échéance</CardTitle>
                        <Clock className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data?.nextDueDate ? new Date(data.nextDueDate).toLocaleDateString() : "Aucune"}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border bg-card">
                <CardHeader>
                    <CardTitle>Historique des paiements</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {data?.payments?.length === 0 ? (
                            <p className="text-center py-8 text-muted-foreground">Aucun paiement enregistré.</p>
                        ) : (
                            data?.payments?.map((payment: any) => (
                                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-secondary/10">
                                            <CreditCard className="w-4 h-4 text-secondary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{payment.feeName}</p>
                                            <p className="text-xs text-muted-foreground">{new Date(payment.date).toLocaleDateString()} &middot; {payment.method}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold text-sm">{formatCurrency(payment.amount)}</p>
                                            <p className="text-[10px] text-secondary font-medium">Validé</p>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => generateReceipt(payment)}
                                            title="Imprimer le reçu"
                                        >
                                            <Printer className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
