"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { FilePlus2, AlertCircle, ArrowRight, Zap, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";

export default function BulkInvoicePage() {
    const router = useRouter();
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedLevel, setSelectedLevel] = useState("");
    const [selectedFee, setSelectedFee] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [classLevels, setClassLevels] = useState<any[]>([]);
    const [fees, setFees] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/class-levels").then(r => r.json()).then(d => setClassLevels(d.data ?? d)).catch(() => {});
        fetch("/api/fees").then(r => r.json()).then(d => setFees(d.data ?? d)).catch(() => {});
    }, []);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch("/api/payments/bulk-invoice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classLevelId: selectedLevel, feeId: selectedFee, academicYearId: selectedYear }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Erreur");
            }
            const data = await res.json();
            setSuccess(`Facturation par lot effectuée avec succès pour ${data.count ?? ""} élèves.`);
        } catch (err: any) {
            setError(err.message || "Une erreur est survenue");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <PageGuard permission={[Permission.FEE_CREATE]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6 max-w-3xl mx-auto">
                <PageHeader
                    title="Facturation en Masse"
                    description="Générez des frais de scolarité pour une classe ou un niveau entier en un clic"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finance", href: "/dashboard/finance" },
                        { label: "Facturation groupée" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="bg-muted/30 border-b border-border pb-6">
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-primary fill-primary/20" />
                                    Génération Rapide
                                </CardTitle>
                                <CardDescription>
                                    Sélectionnez les critères pour générer automatiquement les factures à tous les élèves correspondants.
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleGenerate}>
                                <CardContent className="pt-6 space-y-6">
                                    {error && (
                                        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 text-sm flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {error}
                                        </div>
                                    )}
                                    {success && (
                                        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 text-sm">
                                            {success}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="target">Cible de la facturation</Label>
                                            <Select defaultValue="level">
                                                <SelectTrigger id="target" className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="level">Tout un niveau (ex: 6ème)</SelectItem>
                                                    <SelectItem value="class">Une classe spécifique</SelectItem>
                                                    <SelectItem value="all">Toute l'école (T1, T2...)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="levelOrClass">Niveau / Classe</Label>
                                            <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                                <SelectTrigger id="levelOrClass" className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {classLevels.map((cl: any) => (
                                                        <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-border">
                                        <h3 className="font-medium text-sm text-foreground">Détails des frais</h3>

                                        <div className="space-y-2">
                                            <Label htmlFor="feeType">Type de frais</Label>
                                            <Select value={selectedFee} onValueChange={setSelectedFee}>
                                                <SelectTrigger id="feeType" className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {fees.map((fee: any) => (
                                                        <SelectItem key={fee.id} value={fee.id}>{fee.name ?? fee.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="amount">Montant (FCFA)</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    required
                                                    defaultValue={45000}
                                                    className="bg-background font-medium"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="dueDate">Date d'échéance</Label>
                                                <Input
                                                    id="dueDate"
                                                    type="date"
                                                    required
                                                    className="bg-background"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/10 border-t border-border py-4 flex justify-between">
                                    <Button type="button" variant="outline" onClick={() => router.back()}>
                                        Annuler
                                    </Button>
                                    <Button type="submit" disabled={isGenerating}>
                                        {isGenerating ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                Traitement...
                                            </>
                                        ) : (
                                            <>
                                                <FilePlus2 className="w-4 h-4 mr-2" />
                                                Générer les factures
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="border-border shadow-sm border-dashed bg-muted/20">
                            <CardContent className="pt-6 text-center space-y-4">
                                <ListChecks className="w-12 h-12 text-muted-foreground mx-auto" />
                                <div>
                                    <h3 className="font-medium text-foreground">Prévisualisation</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        45 élèves de 6ème seront facturés de 45 000 FCFA chacun.
                                    </p>
                                </div>
                                <div className="p-3 bg-background border border-border rounded text-sm text-left">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-muted-foreground">Total attendu:</span>
                                        <span className="font-semibold text-foreground">2 025 000 FCFA</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
