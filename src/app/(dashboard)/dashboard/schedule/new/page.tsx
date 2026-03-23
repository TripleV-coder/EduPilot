"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { Save, AlertCircle, ArrowLeft, Loader2, Clock } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/i18n";

type TeacherAvailability = {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
};

const DAYS_OF_WEEK = [
    { value: 1, label: "Lundi" },
    { value: 2, label: "Mardi" },
    { value: 3, label: "Mercredi" },
    { value: 4, label: "Jeudi" },
    { value: 5, label: "Vendredi" },
    { value: 6, label: "Samedi" },
    { value: 7, label: "Dimanche" }
];

export default function NewSchedulePage() {
    const router = useRouter();
    const { toast } = useToast();

    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [classSubjects, setClassSubjects] = useState<any[]>([]);

    const [selectedSubjectId, setSelectedSubjectId] = useState("");
    const [dayOfWeek, setDayOfWeek] = useState(1);
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("10:00");
    const [room, setRoom] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [teacherAvailability, setTeacherAvailability] = useState<TeacherAvailability[]>([]);

    // Initial Classes Load
    useEffect(() => {
        const fetchClasses = async () => {
            try {
                const res = await fetch("/api/classes");
                if (res.ok) {
                    const data = await res.json();
                    setClasses(Array.isArray(data) ? data : data.classes || []);
                }
            } catch {
                setError("Erreur lors du chargement des classes.");
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, []);

    // Load Subjects for selected class
    useEffect(() => {
        if (!selectedClassId) {
            setClassSubjects([]);
            setSelectedSubjectId("");
            return;
        }
        const fetchClassSubjects = async () => {
            try {
                const res = await fetch(`/api/class-subjects?classId=${selectedClassId}`);
                if (res.ok) {
                    const data = await res.json();
                    setClassSubjects(Array.isArray(data) ? data : []);
                }
            } catch {
                setError("Erreur lors du chargement des matières.");
            }
        };
        fetchClassSubjects();
    }, [selectedClassId]);

    // Fetch teacher availability when a class-subject (teacher) is selected
    useEffect(() => {
        setTeacherAvailability([]);
        if (!selectedSubjectId) return;
        const selectedCs = classSubjects.find(cs => cs.id === selectedSubjectId);
        const teacherId = selectedCs?.teacher?.id || selectedCs?.teacherId;
        if (!teacherId) return;

        const fetchAvailability = async () => {
            try {
                const res = await fetch(`/api/teachers/${teacherId}/availability`);
                if (res.ok) {
                    const data = await res.json();
                    setTeacherAvailability(Array.isArray(data) ? data : data.availabilities || []);
                }
            } catch {
                // Non-critical: availability is optional info
            }
        };
        fetchAvailability();
    }, [selectedSubjectId, classSubjects]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        if (!selectedClassId || !selectedSubjectId || !startTime || !endTime) {
            setError("Veuillez remplir tous les champs obligatoires.");
            setSaving(false);
            return;
        }

        const payload = {
            classId: selectedClassId,
            classSubjectId: selectedSubjectId,
            dayOfWeek: dayOfWeek,
            startTime,
            endTime,
            room: room || null
        };

        try {
            const res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Erreur lors de la planification du cours");
            }

            toast({
                title: "Créneau Enregistré",
                description: "Le cours a été ajouté à l'emploi du temps avec succès.",
                variant: "default",
            });

            router.push("/dashboard/schedule");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
        );
    }

    return (
        <PageGuard permission={Permission.SCHEDULE_CREATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-4xl mx-auto pb-12">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/schedule">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <PageHeader
                        title="Planifier un cours"
                        description="Associez un enseignant et une matière à un créneau horaire."
                    />
                </div>

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <Card className="border-border">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Classe <span className="text-destructive">*</span></Label>
                                    <select
                                        value={selectedClassId}
                                        onChange={(e) => setSelectedClassId(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        required
                                    >
                                        <option value="">Sélectionner une classe...</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Matière & Enseignant <span className="text-destructive">*</span></Label>
                                    <select
                                        value={selectedSubjectId}
                                        onChange={(e) => setSelectedSubjectId(e.target.value)}
                                        disabled={!selectedClassId}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                        required
                                    >
                                        <option value="">Sélectionner...</option>
                                        {classSubjects.map(cs => (
                                            <option key={cs.id} value={cs.id}>
                                                {cs.subject?.name} ({cs.teacher?.user?.lastName || 'Intérim'})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-1">Vous devez d'abord assigner un prof à la classe dans &quot;Configuration &gt; Matières&quot;</p>
                                </div>
                            </div>

                            {/* Teacher availability info */}
                            {teacherAvailability.length > 0 && (
                                <div className="md:col-span-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        Disponibilités de l'enseignant
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {teacherAvailability.filter(a => a.isActive).map((a) => {
                                            const dayLabel = DAYS_OF_WEEK.find(d => d.value === a.dayOfWeek)?.label || `Jour ${a.dayOfWeek}`;
                                            return (
                                                <span key={a.id} className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-md font-medium">
                                                    {dayLabel} {a.startTime}-{a.endTime}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t">
                                <div className="space-y-2">
                                    <Label>Jour de la Semaine <span className="text-destructive">*</span></Label>
                                    <select
                                        value={dayOfWeek}
                                        onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        required
                                    >
                                        {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Heure de Début <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Heure de Fin <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Salle (Optionnel)</Label>
                                    <Input
                                        
                                        value={room}
                                        onChange={(e) => setRoom(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
                                <Link href="/dashboard/schedule">
                                    <Button variant="outline" type="button" disabled={saving}>{t("common.cancel")}</Button>
                                </Link>
                                <Button type="submit" disabled={saving} className="gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {saving ? t("common.saving") : t("appActions.planCourse")}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
