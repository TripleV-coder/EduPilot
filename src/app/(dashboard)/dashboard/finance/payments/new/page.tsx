"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Permission } from "@/lib/rbac/permissions";
import { CreditCard, Save, AlertCircle, CheckCircle, ArrowLeft, Search, User, DollarSign, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { Textarea } from "@/components/ui/textarea";

export default function NewPaymentPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [fees, setFees] = useState<any[]>([]);

    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [selectedFeeId, setSelectedFeeId] = useState("");
    const [amount, setAmount] = useState("");
    const [method, setMethod] = useState("CASH");
    const [reference, setReference] = useState("");
    const [notes, setNotes] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
    const [downloadingInvoice, setDownloadingInvoice] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch basic data (Fees usually)
                const fRes = await fetch("/api/fees");
                if (fRes.ok) {
                    const data = await fRes.json();
                    setFees(Array.isArray(data) ? data : data.data || []);
                }
            } catch {
                setError("Erreur lors du chargement des frais.");
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Search students on typing
    useEffect(() => {
        if (searchTerm.length < 2) {
            setStudents([]);
            return;
        }

        const searchStudents = async () => {
            try {
                const res = await fetch(`/api/students?search=${encodeURIComponent(searchTerm)}&limit=10`);
                if (res.ok) {
                    const data = await res.json();
                    setStudents(Array.isArray(data) ? data : data.students || []);
                }
            } catch {
                setError("Erreur lors de la recherche d'élèves.");
            }
        };

        const timer = setTimeout(() => searchStudents(), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // When a fee is selected, auto-fill the amount
    useEffect(() => {
        if (selectedFeeId) {
            const fee = fees.find(f => f.id === selectedFeeId);
            if (fee) {
                setAmount(fee.amount.toString());
            }
        } else {
            setAmount("");
        }
    }, [selectedFeeId, fees]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        if (!selectedStudentId || !selectedFeeId || !amount) {
            setError("Veuillez remplir tous les champs obligatoires (Élève, Frais, Montant).");
            setSaving(false);
            return;
        }

        const payload = {
            studentId: selectedStudentId,
            feeId: selectedFeeId,
            amount: parseFloat(amount),
            method,
            reference: reference || undefined,
            notes: notes || undefined,
        };

        try {
            // Route to the appropriate API based on payment method
            const isMobileMoney = method === "MOBILE_MONEY_MTN" || method === "MOBILE_MONEY_MOOV";

            let payment: any;

            if (isMobileMoney) {
                // Initiate mobile money payment via provider
                const initiateRes = await fetch("/api/payments/initiate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        amount: parseFloat(amount),
                        feeId: selectedFeeId,
                        studentId: selectedStudentId,
                        provider: method === "MOBILE_MONEY_MTN" ? "MTN" : "MOOV",
                    }),
                });

                if (!initiateRes.ok) {
                    const data = await initiateRes.json();
                    throw new Error(data.error || "Erreur lors de l'initiation du paiement mobile.");
                }

                const initiateData = await initiateRes.json();
                payment = { id: initiateData.paymentId };

                // Redirect to provider payment page if URL is returned
                if (initiateData.paymentUrl) {
                    window.open(initiateData.paymentUrl, "_blank");
                }
            } else {
                // Use the optimized cash payment API for all manual entries
                const res = await fetch("/api/payments/cash", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Erreur lors de l'encaissement.");
                }

                payment = await res.json();
            }

            setLastPaymentId(payment.id);
            const mobileNote = isMobileMoney ? " Paiement mobile initié, en attente de confirmation." : "";
            setSuccessMsg("Paiement enregistré avec succès. Reçu N° " + payment.id.slice(-6).toUpperCase() + mobileNote);
            // Reset form for next payment
            setSelectedStudentId("");
            setSelectedFeeId("");
            setAmount("");
            setReference("");
            setNotes("");
            setSearchTerm("");
            setStudents([]);

            window.scrollTo(0, 0);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadInvoice = async () => {
        if (!lastPaymentId) return;
        setDownloadingInvoice(true);
        try {
            const res = await fetch(`/api/payments/${lastPaymentId}/invoice`);
            if (!res.ok) throw new Error("Erreur lors de la génération du reçu");
            const data = await res.json();
            if (data.pdf) {
                const link = document.createElement("a");
                link.href = data.pdf;
                link.download = data.filename || `recu_${lastPaymentId}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch {
            alert("Impossible de télécharger le reçu.");
        } finally {
            setDownloadingInvoice(false);
        }
    };

    const selectedStudent = students.find(s => s.id === selectedStudentId);

    return (
        <PageGuard permission={Permission.FINANCE_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/finance">
                        <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <PageHeader
                        title="Nouvel Encaissement"
                        description="Terminal de saisie de paiement pour la scolarité et autres frais."
                    />
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {successMsg && (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">{successMsg}</p>
                        </div>
                        <Button
                            variant="outline"
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-2"
                            onClick={handleDownloadInvoice}
                            disabled={!lastPaymentId || downloadingInvoice}
                        >
                            {downloadingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Télécharger le reçu
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Colonne Recherche Élève */}
                    <div className="lg:col-span-1 space-y-4">
                        <Card className="border-border">
                            <CardHeader className="bg-muted/30 pb-4 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    1. Identifier l'Élève
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <div className="space-y-2 relative">
                                    <Label>Recherche par nom ou matricule</Label>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Résultats de recherche */}
                                {students.length > 0 && !selectedStudentId && (
                                    <div className="border rounded-md overflow-hidden bg-card max-h-60 overflow-y-auto">
                                        {students.map(stu => (
                                            <div
                                                key={stu.id}
                                                onClick={() => { setSelectedStudentId(stu.id); setSearchTerm(""); }}
                                                className="p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer text-sm"
                                            >
                                                <div className="font-medium">{stu.user?.firstName} {stu.user?.lastName}</div>
                                                <div className="text-xs text-muted-foreground flex justify-between">
                                                    <span>{stu.matricule}</span>
                                                    <span className="bg-secondary/10 text-secondary px-1 rounded">{stu.class?.name || "Aucune classe"}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Élève Sélectionné */}
                                {selectedStudentId && (
                                    <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-start gap-3 relative">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground"
                                            onClick={() => setSelectedStudentId("")}
                                        >
                                            ×
                                        </Button>
                                        <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                                            {selectedStudent?.user?.firstName?.[0]}{selectedStudent?.user?.lastName?.[0]}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">{selectedStudent?.user?.firstName} {selectedStudent?.user?.lastName}</h4>
                                            <p className="text-xs text-muted-foreground">Mat: {selectedStudent?.matricule}</p>
                                            <span className="inline-block mt-1 text-[10px] bg-background border px-1.5 py-0.5 rounded shadow-sm font-medium">
                                                {selectedStudent?.class?.name || "Classe N/A"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Colonne Infos du Paiement */}
                    <div className="lg:col-span-2">
                        <Card className="border-border shadow-sm h-full">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-primary" />
                                    2. Détails de l'Encaissement
                                </CardTitle>
                                <CardDescription>Saisissez le montant et le mode de paiement.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={handleSave} className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Ligne Tarifaire (Frais) <span className="text-destructive">*</span></Label>
                                            <select
                                                value={selectedFeeId}
                                                onChange={e => setSelectedFeeId(e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                                required
                                                disabled={!selectedStudentId}
                                            >
                                                <option value="">Sélectionner un frais...</option>
                                                {fees.map(f => (
                                                    <option key={f.id} value={f.id}>
                                                        {f.name} ({(f.amount).toLocaleString('fr-BJ')} FCFA)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2 align-top">
                                            <Label>Montant Payé (FCFA) <span className="text-destructive">*</span></Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    value={amount}
                                                    onChange={e => setAmount(e.target.value)}
                                                    className="font-mono text-lg pl-8"
                                                    disabled={!selectedStudentId}
                                                />
                                                <DollarSign className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">Modifier le montant en cas de paiement partiel ou de tranche.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Mode de Paiement <span className="text-destructive">*</span></Label>
                                            <select
                                                value={method}
                                                onChange={e => setMethod(e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                                disabled={!selectedStudentId}
                                            >
                                                <option value="CASH">Espèces (Cash)</option>
                                                <option value="MOBILE_MONEY_MTN">Mobile Money (MTN)</option>
                                                <option value="MOBILE_MONEY_MOOV">Mobile Money (Moov)</option>
                                                <option value="BANK_TRANSFER">Virement Bancaire</option>
                                                <option value="CHECK">Chèque</option>
                                                <option value="OTHER">Autre</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Référence de transaction (Optionnel)</Label>
                                            <Input
                                                value={reference}
                                                onChange={e => setReference(e.target.value)}
                                                
                                                disabled={!selectedStudentId || method === "CASH"}
                                            />
                                        </div>

                                        <div className="space-y-2 md:col-span-2">
                                            <Label>Observations</Label>
                                            <Textarea
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                
                                                disabled={!selectedStudentId}
                                                className="resize-none h-20"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 flex justify-end">
                                        <Button type="submit" disabled={saving || !selectedStudentId} className="w-full sm:w-auto min-w-[200px] gap-2">
                                            {saving ? <span className="animate-spin rounded-full h-4 w-4 border-b-2" /> : <Save className="h-4 w-4" />}
                                            Valider l'Encaissement
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
