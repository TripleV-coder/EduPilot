"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useRouter } from "next/navigation";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { 
  Save, AlertCircle, CheckCircle, Search, UserCheck, 
  Users, Clock, ShieldAlert, ArrowLeft, Filter, Calendar
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { PageCallout } from "@/components/layout/page-callout";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { ToastAction } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

type RawStudent = {
    id: string;
    matricule?: string;
    user?: {
        firstName: string | null;
        lastName: string | null;
    } | null;
};

type AttendanceRecord = {
    studentId: string;
    studentName: string;
    status: string; // 'PRESENT', 'ABSENT', 'EXCUSED'
    notes: string;
};

export default function AttendancePage() {
    const router = useRouter();
    const { isFocusMode } = useSidebar();
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(false);

    const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord>>({});
    const [initialAttendanceData, setInitialAttendanceData] = useState<Record<string, AttendanceRecord>>({});
    const [orderedStudentIds, setOrderedStudentIds] = useState<string[]>([]);

    // Initial load
    const { data: classesData, isLoading: classesLoading } = useSWR("/api/classes", fetcher);
    useEffect(() => {
        if (classesData) setClasses(Array.isArray(classesData) ? classesData : classesData.data || []);
    }, [classesData]);

    // Fetch students and current attendance
    useEffect(() => {
        if (!selectedClassId || !selectedDate) return;

        const fetchData = async () => {
            setIsFetchingData(true);
            try {
                const [stuRes, attRes] = await Promise.all([
                    fetch(`/api/students?classId=${selectedClassId}&limit=1000`),
                    fetch(`/api/attendance/bulk?classId=${selectedClassId}&date=${selectedDate}`)
                ]);

                const stuData = await stuRes.json();
                const existingRecords = attRes.ok ? await attRes.json() : [];
                
                const studentsList: RawStudent[] = Array.isArray(stuData) ? stuData : stuData.students || [];
                const newAttrMap: Record<string, AttendanceRecord> = {};
                const orderedIds: string[] = [];

                studentsList.forEach(stu => {
                    orderedIds.push(stu.id);
                    const existing = existingRecords.find((r: any) => r.studentId === stu.id);
                    newAttrMap[stu.id] = {
                        studentId: stu.id,
                        studentName: `${stu.user?.lastName || ""} ${stu.user?.firstName || ""}`.trim() || "Inconnu",
                        status: existing ? existing.status : "PRESENT",
                        notes: existing?.reason || ""
                    };
                });

                setAttendanceData(newAttrMap);
                setInitialAttendanceData(newAttrMap);
                setOrderedStudentIds(orderedIds);
            } catch (e) {
                toast({ title: "Erreur", description: "Impossible de charger les données", variant: "destructive" });
            } finally {
                setIsFetchingData(false);
            }
        };
        fetchData();
    }, [selectedClassId, selectedDate]);

    const handleStatusChange = (studentId: string, status: string) => {
        setAttendanceData(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], status }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const records = Object.values(attendanceData).map(rec => ({
                studentId: rec.studentId,
                status: rec.status,
                notes: rec.notes
            }));

            const res = await fetch("/api/attendance/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classId: selectedClassId, date: selectedDate, records })
            });

            if (!res.ok) throw new Error("Erreur de sauvegarde");
            setInitialAttendanceData(attendanceData);
            toast({
                title: t("attendance.toasts.savedTitle"),
                description: t("attendance.toasts.savedDescription"),
                action: (
                    <ToastAction altText={t("attendance.toasts.viewAnalytics")} onClick={() => router.push("/dashboard/analytics")}>
                        {t("attendance.toasts.viewAnalytics")}
                    </ToastAction>
                ),
            });
        } catch (e) {
            toast({ title: "Erreur", description: "Erreur lors de la sauvegarde", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const dirtyCount = useMemo(() => {
        return orderedStudentIds.reduce((acc, id) => {
            const current = attendanceData[id];
            const initial = initialAttendanceData[id];
            if (!current || !initial) return acc;
            if (current.status !== initial.status || (current.notes || "") !== (initial.notes || "")) {
                return acc + 1;
            }
            return acc;
        }, 0);
    }, [attendanceData, initialAttendanceData, orderedStudentIds]);

    const filteredIds = orderedStudentIds.filter(id => 
        attendanceData[id]?.studentName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = Object.values(attendanceData).reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, { PRESENT: 0, ABSENT: 0, EXCUSED: 0 } as any);

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
            <div className={cn("max-w-[1200px] mx-auto animate-fade-in pb-24", isFocusMode ? "space-y-4" : "space-y-6")}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader 
                        title="Feuille d'Appel" 
                        description={isFocusMode ? "Mode focus actif : marquage rapide des présences." : "Saisissez les présences quotidiennes par classe et par date."}
                    />
                    {!isFocusMode && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase" onClick={() => window.print()}>
                                Imprimer
                            </Button>
                        </div>
                    )}
                </div>

                {/* Configuration */}
                <Card className="border-none shadow-none bg-muted/20">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-5 space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Sélectionner la classe</Label>
                                <select
                                    value={selectedClassId}
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    className="flex h-9 w-full rounded-lg border border-border/50 bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="">Choisir une classe...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-4 space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Date de l'appel</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="h-9 pl-9 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-3">
                                <div className={cn("flex justify-between p-2 rounded-lg bg-background/50 border border-border/50", isFocusMode && "py-1")}>
                                    <div className="text-center px-2">
                                        <p className="text-[9px] font-bold text-emerald-600 uppercase">Présents</p>
                                        <p className="text-sm font-bold">{stats.PRESENT}</p>
                                    </div>
                                    <div className="text-center px-2 border-x border-border/50">
                                        <p className="text-[9px] font-bold text-destructive uppercase">Absents</p>
                                        <p className="text-sm font-bold">{stats.ABSENT}</p>
                                    </div>
                                    <div className="text-center px-2">
                                        <p className="text-[9px] font-bold text-orange-500 uppercase">Excusés</p>
                                        <p className="text-sm font-bold">{stats.EXCUSED}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* List */}
                {!selectedClassId && (
                    <PageCallout
                        icon={UserCheck}
                        title="Sélectionnez une classe pour démarrer l’appel"
                        description="Choisissez la classe et la date, puis marquez les présents/absents. Vous pourrez ensuite enregistrer l’appel en bas de page."
                        tone="info"
                    />
                )}

                {selectedClassId && (
                    <Card className="border-none shadow-none bg-muted/20 overflow-hidden">
                        <div className="p-4 border-b border-border/50 bg-background/40 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    
                                    className="h-8 pl-9 text-xs bg-background border-none ring-1 ring-border/50 focus-visible:ring-primary/30"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {!isFocusMode && (
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold uppercase flex-1 sm:flex-none" onClick={() => {
                                        const next = { ...attendanceData };
                                        Object.keys(next).forEach(id => next[id].status = "PRESENT");
                                        setAttendanceData(next);
                                    }}>Tous Présents</Button>
                                </div>
                            )}
                        </div>
                        <CardContent className="p-0">
                            {dirtyCount > 0 && (
                                <div className="px-4 py-2 text-[11px] text-primary bg-primary/5 border-b border-primary/10">
                                    {dirtyCount} modification{dirtyCount > 1 ? "s" : ""} non enregistrée{dirtyCount > 1 ? "s" : ""}
                                </div>
                            )}
                            {isFetchingData ? (
                                <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                            ) : filteredIds.length === 0 ? (
                                <div className="p-8">
                                    <PageCallout
                                        icon={Users}
                                        title="Aucun élève à afficher"
                                        description="Aucun élève ne correspond à la recherche, ou la classe ne contient pas encore d’inscriptions actives."
                                        tone="neutral"
                                    />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-background/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                                            <tr>
                                                <th className="px-6 py-3">Élève</th>
                                                <th className="px-6 py-3 text-center w-48">Statut</th>
                                                {!isFocusMode && <th className="px-6 py-3">Observations / Justificatifs</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {filteredIds.map(id => {
                                                const rec = attendanceData[id];
                                                return (
                                                    <tr key={id} className="hover:bg-background/40 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-bold text-foreground">{rec.studentName}</p>
                                                            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter mt-0.5">
                                                                {orderedStudentIds.indexOf(id) + 1}. MATRICULE: 00{id.slice(-4).toUpperCase()}
                                                            </p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex justify-center items-center gap-3">
                                                                <button
                                                                    onClick={() => handleStatusChange(id, 'PRESENT')}
                                                                    className={cn(
                                                                        "w-8 h-8 rounded-full border-2 font-bold text-[11px] transition-all flex items-center justify-center",
                                                                        rec.status === 'PRESENT' ? "bg-emerald-500 border-emerald-500 text-white shadow-lg scale-110" : "border-border/50 text-muted-foreground hover:border-emerald-200"
                                                                    )}
                                                                    title="Présent"
                                                                >P</button>
                                                                <button
                                                                    onClick={() => handleStatusChange(id, 'ABSENT')}
                                                                    className={cn(
                                                                        "w-8 h-8 rounded-full border-2 font-bold text-[11px] transition-all flex items-center justify-center",
                                                                        rec.status === 'ABSENT' ? "bg-destructive border-destructive text-white shadow-lg scale-110" : "border-border/50 text-muted-foreground hover:border-destructive/20"
                                                                    )}
                                                                    title="Absent"
                                                                >A</button>
                                                                <button
                                                                    onClick={() => handleStatusChange(id, 'EXCUSED')}
                                                                    className={cn(
                                                                        "w-8 h-8 rounded-full border-2 font-bold text-[11px] transition-all flex items-center justify-center",
                                                                        rec.status === 'EXCUSED' ? "bg-orange-500 border-orange-500 text-white shadow-lg scale-110" : "border-border/50 text-muted-foreground hover:border-orange-200"
                                                                    )}
                                                                    title="Excusé"
                                                                >E</button>
                                                            </div>
                                                        </td>
                                                        {!isFocusMode && (
                                                            <td className="px-6 py-4">
                                                                <Input
                                                                    value={rec.notes}
                                                                    onChange={e => setAttendanceData(p => ({ ...p, [id]: { ...p[id], notes: e.target.value } }))}
                                                                    className="h-8 text-[11px] bg-background/50 border-none ring-1 ring-border/50 focus-visible:ring-primary/30"
                                                                />
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Floating Save Button */}
                {selectedClassId && filteredIds.length > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[400px] px-4">
                        <Button 
                            className="w-full h-12 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-sm font-bold uppercase tracking-widest gap-2 animate-in slide-in-from-bottom-4 duration-500 action-critical touch-target"
                            onClick={handleSave}
                            disabled={saving || dirtyCount === 0}
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {dirtyCount > 0 ? t("common.saveWithCount", { count: dirtyCount }) : t("common.noChanges")}
                        </Button>
                    </div>
                )}
            </div>
        </PageGuard>
    );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 2v4"/>
    <path d="m16.2 7.8 2.9-2.9"/>
    <path d="M18 12h4"/>
    <path d="m16.2 16.2 2.9 2.9"/>
    <path d="M12 18v4"/>
    <path d="m4.9 19.1 2.9-2.9"/>
    <path d="M2 12h4"/>
    <path d="m4.9 4.9 2.9 2.9"/>
  </svg>
);
