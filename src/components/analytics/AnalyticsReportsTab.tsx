"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Clock, Layout, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAnalytics } from "@/components/analytics/AnalyticsContext";
import { buildReportSections, type ReportBlockKey } from "@/lib/analytics/report-builder";
import { exportToCSV } from "@/lib/utils/export";
import {
    loadRecentReports,
    recordRecentReport,
    type RecentReportEntry,
} from "@/lib/storage/report-history";

export function AnalyticsReportsTab() {
    const [reportTitle, setReportTitle] = useState("Rapport Analytique - " + new Date().toLocaleDateString('fr-FR'));
    const [reportBlocks, setReportBlocks] = useState<Record<ReportBlockKey, boolean>>({
        overview: true,
        performances: true,
        attendance: true,
        risks: true,
        finance: false,
    });
    const [reportBlockOrder, setReportBlockOrder] = useState<ReportBlockKey[]>([
        "overview", "performances", "attendance", "risks", "finance",
    ]);

    const dragItem = useRef<ReportBlockKey | null>(null);
    const dragOverItem = useRef<ReportBlockKey | null>(null);

    const { establishmentId, academicYearId, periodId, classIds, subjectIds } = useAnalytics();
    const [busy, setBusy] = useState<"PDF" | "CSV" | null>(null);
    const [recent, setRecent] = useState<RecentReportEntry[]>([]);

    useEffect(() => {
        setRecent(loadRecentReports());
    }, []);

    const handleDragEnd = useCallback(() => {
        if (!dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) return;
        setReportBlockOrder((prev) => {
            const next = [...prev];
            const fromIdx = next.indexOf(dragItem.current!);
            const toIdx = next.indexOf(dragOverItem.current!);
            if (fromIdx === -1 || toIdx === -1) return prev;
            next.splice(fromIdx, 1);
            next.splice(toIdx, 0, dragItem.current!);
            return next;
        });
        dragItem.current = null;
        dragOverItem.current = null;
    }, []);

    const toggleBlock = (key: ReportBlockKey) => {
        setReportBlocks(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleExport = useCallback(async (format: "PDF" | "CSV") => {
        if (busy) return;
        setBusy(format);
        const toastId = toast.loading(`Génération du rapport ${format}…`);
        try {
            const sections = await buildReportSections({
                filters: {
                    schoolId: establishmentId,
                    academicYearId,
                    periodId,
                    classIds,
                    subjectIds,
                },
                blocks: reportBlocks,
                order: reportBlockOrder,
            });

            if (sections.length === 0) {
                toast.error("Sélectionnez au moins une section à exporter.", { id: toastId });
                return;
            }

            const timestamp = new Date();
            if (format === "CSV") {
                const merged: (string | number)[][] = sections.flatMap((s, idx) => [
                    ...(idx > 0 ? [[""], [""]] : []),
                    [s.title],
                    s.headers,
                    ...s.rows,
                ]);
                exportToCSV({
                    title: reportTitle,
                    headers: [],
                    rows: merged,
                    timestamp,
                });
            } else {
                const { jsPDF } = await import("jspdf");
                const autoTable = (await import("jspdf-autotable")).default;
                const doc = new jsPDF();
                const date = timestamp.toLocaleDateString("fr-FR");
                doc.setFontSize(16);
                doc.text(reportTitle, 14, 18);
                doc.setFontSize(10);
                doc.text(`Généré le ${date}`, 14, 26);
                let cursorY = 34;
                sections.forEach((section, idx) => {
                    if (idx > 0) cursorY += 8;
                    doc.setFontSize(12);
                    doc.text(section.title, 14, cursorY);
                    cursorY += 4;
                    autoTable(doc, {
                        head: [section.headers],
                        body: section.rows,
                        startY: cursorY,
                        margin: { left: 14, right: 14 },
                    });
                    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
                });
                const safe = reportTitle.replace(/[^a-z0-9-_]+/gi, "_");
                doc.save(`${safe}_${date.replace(/\//g, "-")}.pdf`);
            }

            toast.success(`Rapport ${format} généré.`, { id: toastId });
            setRecent(recordRecentReport({
                title: reportTitle,
                format,
                generatedAt: timestamp.toISOString(),
            }));
        } catch (err) {
            console.error("[AnalyticsReportsTab] export failed", err);
            toast.error(`Échec de l'export ${format}.`, { id: toastId });
        } finally {
            setBusy(null);
        }
    }, [busy, reportTitle, reportBlocks, reportBlockOrder, establishmentId, academicYearId, periodId, classIds, subjectIds]);

    const blockLabels: Record<ReportBlockKey, { label: string, desc: string }> = {
        overview: { label: "Synthèse Globale", desc: "KPIs principaux, taux de réussite et moyennes." },
        performances: { label: "Performances Académiques", desc: "Radar des matières et distribution des notes." },
        attendance: { label: "Assiduité & Ponctualité", desc: "Calendrier thermique et patterns d'absence." },
        risks: { label: "Risques & Décrochage", desc: "Élèves à surveiller et interventions IA." },
        finance: { label: "Santé Financière", desc: "Recouvrement, trésorerie et impayés." },
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generator Configuration */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="dashboard-block border-border shadow-md" data-reveal>
                    <CardHeader className="bg-muted/10 border-b">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                <Layout className="w-4 h-4" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-bold uppercase tracking-tight">Configuration du Rapport</CardTitle>
                                <CardDescription className="text-[10px]">Personnalisez le contenu et l&apos;ordre des sections.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Titre du document</label>
                            <Input
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                className="h-12 text-lg font-bold bg-muted/5 border-dashed focus:border-primary"
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sections à inclure (Glisser pour réordonner)</label>
                            <div className="space-y-2">
                                {reportBlockOrder.map((key) => (
                                    <div
                                        key={key}
                                        draggable
                                        onDragStart={() => { dragItem.current = key; }}
                                        onDragEnter={() => { dragOverItem.current = key; }}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => e.preventDefault()}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all group ${
                                            reportBlocks[key] ? "bg-card border-border shadow-sm" : "bg-muted/20 border-transparent opacity-60"
                                        }`}
                                    >
                                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <Checkbox
                                            checked={reportBlocks[key]}
                                            onCheckedChange={() => toggleBlock(key)}
                                            className="data-[state=checked]:bg-primary"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold">{blockLabels[key].label}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium">{blockLabels[key].desc}</p>
                                        </div>
                                        {reportBlocks[key] && <Badge variant="secondary" className="text-[9px] font-bold bg-primary/5 text-primary border-primary/10">Inclus</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions & History */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="dashboard-block border-border shadow-lg overflow-hidden" data-reveal>
                    <CardHeader className="bg-primary text-primary-foreground">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest">Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-3">
                        <Button
                            className="w-full h-12 gap-3 font-bold uppercase tracking-tighter shadow-md action-critical"
                            onClick={() => handleExport("PDF")}
                            disabled={busy !== null}
                        >
                            {busy === "PDF" ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                            {busy === "PDF" ? "Génération…" : "Générer PDF"}
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full h-12 gap-3 font-bold uppercase tracking-tighter"
                            onClick={() => handleExport("CSV")}
                            disabled={busy !== null}
                        >
                            {busy === "CSV" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                            {busy === "CSV" ? "Génération…" : "Exporter CSV"}
                        </Button>
                        <p className="text-[10px] text-center text-muted-foreground mt-4 italic">
                            Le rapport inclura les filtres actuellement actifs dans la barre de contexte globale.
                        </p>
                    </CardContent>
                </Card>

                <Card className="dashboard-block border-border bg-muted/5" data-reveal>
                    <CardHeader>
                        <CardTitle className="text-[11px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Rapports récents
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                            {recent.length === 0 ? (
                                <p className="p-4 text-[11px] text-muted-foreground italic">
                                    Aucun rapport généré pour l&apos;instant.
                                </p>
                            ) : (
                                recent.map((entry) => (
                                    <div
                                        key={entry.generatedAt}
                                        className="p-4 flex items-center justify-between hover:bg-card transition-colors"
                                    >
                                        <div>
                                            <p className="text-xs font-bold">{entry.title}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {entry.format} · {new Date(entry.generatedAt).toLocaleString("fr-FR")}
                                            </p>
                                        </div>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                                            {entry.format}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
