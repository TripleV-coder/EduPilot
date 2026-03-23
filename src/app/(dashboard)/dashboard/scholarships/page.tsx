"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import {
    DollarSign, Search, Loader2, Plus, ArrowRight,
    Percent, HelpCircle, Trophy, HeartHandshake, CheckCircle2, FileText, XCircle
} from "lucide-react";

type Scholarship = {
    id: string;
    name: string;
    type: string;
    amount: number;
    percentage: number | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    student: {
        user: { firstName: string; lastName: string; };
        enrollments: {
            class: {
                classLevel: { name: string; }
            }
        }[];
    };
};

export default function ScholarshipsPage() {
    const [scholarships, setScholarships] = useState<Scholarship[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchScholarships();
    }, []);

    const fetchScholarships = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/scholarships");
            if (res.ok) {
                const data = await res.json();
                setScholarships(data);
            }
        } catch (error) {
            console.error("Failed to fetch scholarships", error);
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "MERIT": return <Trophy className="w-5 h-5 text-yellow-500" />;
            case "NEED_BASED": return <HeartHandshake className="w-5 h-5 text-rose-500" />;
            case "PARTIAL": return <Percent className="w-5 h-5 text-blue-500" />;
            case "FULL": return <DollarSign className="w-5 h-5 text-emerald-500" />;
            default: return <HelpCircle className="w-5 h-5 text-slate-500" />;
        }
    };

    const getTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            "MERIT": "Bourse d'Excellence", "NEED_BASED": "Aide Sociale",
            "ATHLETIC": "Bourse Sportive", "PARTIAL": "Exonération Partielle",
            "FULL": "Exonération Totale", "OTHER": "Autre"
        };
        return types[type] || type;
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Bourses & Aides Financières"
                    description="Gérez les subventions, réductions et exonérations de scolarité attribuées aux élèves."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Finance & Comptabilité" },
                        { label: "Bourses" },
                    ]}
                    actions={
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" /> Attribuer une bourse
                        </Button>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <Card className="shadow-sm border-border bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                            <CardContent className="p-6">
                                <div className="p-3 bg-primary/20 w-fit rounded-xl mb-4 text-primary">
                                    <HeartHandshake className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-bold">{scholarships.filter(s => s.isActive).length}</h3>
                                <p className="text-sm text-muted-foreground font-medium">Bourses Actives</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-border bg-muted/10">
                            <CardContent className="p-6 space-y-3">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <PieChartIcon className="w-4 h-4" />
                                    Types d'Aides
                                </h4>
                                <ul className="text-sm space-y-2 text-foreground/80">
                                    <li className="flex justify-between"><span>Mérite</span> <span className="font-bold">{scholarships.filter(s => s.type === "MERIT").length}</span></li>
                                    <li className="flex justify-between"><span>Sociale</span> <span className="font-bold">{scholarships.filter(s => s.type === "NEED_BASED").length}</span></li>
                                    <li className="flex justify-between"><span>Partielle</span> <span className="font-bold">{scholarships.filter(s => s.type === "PARTIAL").length}</span></li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="md:col-span-3 shadow-sm border-border overflow-hidden min-h-[500px] flex flex-col">
                        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9 bg-background" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground tracking-wide font-semibold border-b bg-muted/40">
                                    <tr>
                                        <th className="px-6 py-4">Élève Bénéficiaire</th>
                                        <th className="px-6 py-4">Type de Bourse</th>
                                        <th className="px-6 py-4">Valeur</th>
                                        <th className="px-6 py-4">Validité</th>
                                        <th className="px-6 py-4">Statut</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                                                <p className="text-muted-foreground">Chargement des dossiers...</p>
                                            </td>
                                        </tr>
                                    ) : scholarships.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                                                <HeartHandshake className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p className="text-lg font-medium text-foreground">Aucune aide recensée</p>
                                                <p className="text-sm">Il n'y a actuellement aucune bourse ou réduction active pour cette année.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        scholarships.map((item) => (
                                            <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-foreground">
                                                        {item.student?.user.firstName} {item.student?.user.lastName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-medium mt-0.5">
                                                        {item.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-muted rounded-md">{getTypeIcon(item.type)}</div>
                                                        <span className="font-medium">{getTypeLabel(item.type)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.percentage ? (
                                                        <span className="inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-500/10 px-2 py-1 rounded">
                                                            {item.percentage}%
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">
                                                            -{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(item.amount)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                                                    Du {new Date(item.startDate).toLocaleDateString("fr-FR")}
                                                    {item.endDate && <span><br />Au {new Date(item.endDate).toLocaleDateString("fr-FR")}</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.isActive ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-600 bg-slate-500/10 px-2.5 py-1 rounded-full border border-slate-500/20">
                                                            <XCircle className="w-3.5 h-3.5" /> Expirée
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button variant="ghost" size="icon" className="group-hover:bg-background">
                                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}

// Composant icône manquant
function PieChartIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
            <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
    )
}
