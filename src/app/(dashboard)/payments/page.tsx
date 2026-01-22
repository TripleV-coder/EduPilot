"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    CreditCard, Search, Download, Plus,
    Loader2, CheckCircle, XCircle, Clock, Banknote
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

interface Payment {
    id: string;
    studentName: string;
    amount: number;
    status: PaymentStatus;
    method: string;
    reference: string;
    createdAt: string;
    feeType: string;
}

const statusConfig: Record<PaymentStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
    COMPLETED: { icon: CheckCircle, color: "text-green-500 bg-green-500/10", label: "Payé" },
    PENDING: { icon: Clock, color: "text-orange-500 bg-orange-500/10", label: "En attente" },
    FAILED: { icon: XCircle, color: "text-red-500 bg-red-500/10", label: "Échoué" },
    REFUNDED: { icon: Banknote, color: "text-blue-500 bg-blue-500/10", label: "Remboursé" },
};

export default function PaymentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");

    // Fetch payments
    const { data: payments, isLoading } = useQuery({
        queryKey: ["payments"],
        queryFn: async () => {
            const res = await fetch("/api/payments");
            return res.json() as Promise<Payment[]>;
        },
    });

    // Stats calculation
    const stats = {
        total: payments?.reduce((acc, p) => acc + (p.status === "COMPLETED" ? p.amount : 0), 0) || 0,
        pending: payments?.filter(p => p.status === "PENDING").length || 0,
        completed: payments?.filter(p => p.status === "COMPLETED").length || 0,
        count: payments?.length || 0,
    };

    const filteredPayments = payments?.filter(p => {
        const matchesSearch = p.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.reference.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = !statusFilter || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    }) || [];

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF" }).format(amount);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gestion des Paiements</h1>
                    <p className="text-muted-foreground">Suivi des frais de scolarité et paiements</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Exporter
                    </Button>
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau paiement
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Total Encaissé</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Paiements Complétés</p>
                        <p className="text-2xl font-bold">{stats.completed}</p>
                    </CardContent>
                </Card>
                <Card className="bg-orange-500/10 border-orange-500/20">
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">En Attente</p>
                        <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Total Transactions</p>
                        <p className="text-2xl font-bold">{stats.count}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher par nom ou référence..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <select
                            className="p-2 border rounded-lg min-w-[150px]"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "")}
                        >
                            <option value="">Tous les statuts</option>
                            <option value="COMPLETED">Payé</option>
                            <option value="PENDING">En attente</option>
                            <option value="FAILED">Échoué</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Payments Table */}
            {!isLoading && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Historique des paiements ({filteredPayments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="pb-3 font-medium">Élève</th>
                                        <th className="pb-3 font-medium">Type</th>
                                        <th className="pb-3 font-medium">Montant</th>
                                        <th className="pb-3 font-medium">Méthode</th>
                                        <th className="pb-3 font-medium">Référence</th>
                                        <th className="pb-3 font-medium">Statut</th>
                                        <th className="pb-3 font-medium">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayments.map((payment, index) => {
                                        const statusInfo = statusConfig[payment.status];
                                        const StatusIcon = statusInfo.icon;

                                        return (
                                            <motion.tr
                                                key={payment.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.02 }}
                                                className="border-b last:border-0 hover:bg-muted/50"
                                            >
                                                <td className="py-3 font-medium">{payment.studentName}</td>
                                                <td className="py-3 text-muted-foreground">{payment.feeType}</td>
                                                <td className="py-3 font-bold">{formatCurrency(payment.amount)}</td>
                                                <td className="py-3">
                                                    <span className="text-xs px-2 py-1 rounded bg-muted">
                                                        {payment.method}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-mono text-xs">{payment.reference}</td>
                                                <td className="py-3">
                                                    <span className={cn(
                                                        "flex items-center gap-1 text-xs px-2 py-1 rounded w-fit",
                                                        statusInfo.color
                                                    )}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-sm text-muted-foreground">
                                                    {new Date(payment.createdAt).toLocaleDateString("fr-FR")}
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filteredPayments.length === 0 && (
                                <div className="py-12 text-center text-muted-foreground">
                                    Aucun paiement trouvé
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
