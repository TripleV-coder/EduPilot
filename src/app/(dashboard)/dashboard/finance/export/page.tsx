"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { FileUp, FileSpreadsheet, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

export default function FinanceExportPage() {
    const [format, setFormat] = useState("excel");
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const selectedTypes: string[] = [];
            if ((document.getElementById("payments") as HTMLInputElement)?.checked) selectedTypes.push("payments");
            if ((document.getElementById("unpaid") as HTMLInputElement)?.checked) selectedTypes.push("unpaid");
            if ((document.getElementById("discounts") as HTMLInputElement)?.checked) selectedTypes.push("discounts");

            const res = await fetch(`/api/finance/export?format=${format}&type=${selectedTypes.join(",")}`);
            if (!res.ok) throw new Error("Erreur d'export");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const contentType = res.headers.get("content-type") || "";
            a.download = `export-finance.${contentType.includes("csv") ? "csv" : format}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setError(err.message || "Une erreur est survenue lors de l'export");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <PageGuard permission={[Permission.FINANCE_READ]} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Export Financier"
                    description="Générez des extractions de données financières pour votre comptabilité"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finance", href: "/dashboard/finance" },
                        { label: "Export" },
                    ]}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-border shadow-sm">
                        <CardHeader className="bg-muted/30 border-b border-border">
                            <CardTitle className="flex items-center gap-2">
                                <FileUp className="w-5 h-5 text-primary" />
                                Configuration de l'export
                            </CardTitle>
                            <CardDescription>
                                Sélectionnez le type de données et la période à exporter
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {error && (
                                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Type de données</Label>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2 bg-background border border-border p-3 rounded-md">
                                        <input type="checkbox" id="payments" className="rounded text-primary" defaultChecked />
                                        <Label htmlFor="payments" className="font-normal cursor-pointer flex-1">
                                            Paiements reçus (Historique complet)
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-background border border-border p-3 rounded-md">
                                        <input type="checkbox" id="unpaid" className="rounded text-primary" defaultChecked />
                                        <Label htmlFor="unpaid" className="font-normal cursor-pointer flex-1">
                                            Factures impayées & Relances
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-background border border-border p-3 rounded-md">
                                        <input type="checkbox" id="discounts" className="rounded text-primary" />
                                        <Label htmlFor="discounts" className="font-normal cursor-pointer flex-1">
                                            Bourses et réductions accordées
                                        </Label>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base font-semibold">Format de sortie</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <label
                                        htmlFor="excel"
                                        className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-colors ${format === 'excel' ? 'border-primary text-primary bg-accent' : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'}`}
                                    >
                                        <input type="radio" id="excel" name="format" value="excel" checked={format === "excel"} onChange={() => setFormat("excel")} className="sr-only" />
                                        <FileSpreadsheet className="mb-3 h-6 w-6" />
                                        Compatible Excel (.csv)
                                    </label>
                                    <label
                                        htmlFor="csv"
                                        className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-colors ${format === 'csv' ? 'border-primary text-primary bg-accent' : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'}`}
                                    >
                                        <input type="radio" id="csv" name="format" value="csv" checked={format === "csv"} onChange={() => setFormat("csv")} className="sr-only" />
                                        <FileText className="mb-3 h-6 w-6" />
                                        Fichier Texte (.csv)
                                    </label>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t border-border mt-4 py-4">
                            <Button className="w-full" size="lg" onClick={handleExport} disabled={isExporting}>
                                {isExporting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Génération en cours...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5 mr-2" />
                                        Générer et télécharger
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    <div className="space-y-6">
                        <Card className="border-border shadow-sm border-dashed bg-muted/20">
                            <CardContent className="pt-6">
                                <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    Export Comptable Standard
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Cet export est compatible avec la majorité des logiciels de comptabilité (Sage, Cegid, QuickBooks). Il inclut les comptes liés aux scolarités.
                                </p>
                                <Button variant="outline" className="w-full">
                                    Lancer l'export standard
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm border-dashed bg-muted/20">
                            <CardContent className="pt-6">
                                <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                    Liste de Relance
                                </h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Génère la liste exacte des parents à relancer ce mois-ci, avec leurs numéros de téléphone et le montant du solde.
                                </p>
                                <Button variant="outline" className="w-full">
                                    {t("appActions.exportRemindersPdf")}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
