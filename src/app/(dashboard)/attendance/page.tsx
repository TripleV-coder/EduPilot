"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Check, X, Clock, Loader2, Calendar, Users,
    ChevronLeft, ChevronRight, Save
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | null;

interface Student {
    id: string;
    name: string;
    matricule: string;
    status: AttendanceStatus;
}

const statusConfig: Record<string, { icon: typeof Check; color: string; label: string }> = {
    PRESENT: { icon: Check, color: "text-green-500 bg-green-500/10", label: "Présent" },
    ABSENT: { icon: X, color: "text-red-500 bg-red-500/10", label: "Absent" },
    LATE: { icon: Clock, color: "text-orange-500 bg-orange-500/10", label: "Retard" },
    EXCUSED: { icon: Check, color: "text-blue-500 bg-blue-500/10", label: "Excusé" },
};

export default function AttendancePage() {
    const queryClient = useQueryClient();
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
    const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceStatus>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch classes
    const { data: classes } = useQuery({
        queryKey: ["classes"],
        queryFn: async () => {
            const res = await fetch("/api/classes");
            return res.json();
        },
    });

    // Fetch students for class
    const { data: students, isLoading } = useQuery({
        queryKey: ["attendance", selectedClass, selectedDate],
        queryFn: async () => {
            if (!selectedClass) return [];
            const res = await fetch(`/api/attendance?classId=${selectedClass}&date=${selectedDate}`);
            const data = await res.json();
            // Initialize local state with fetched data
            const initial: Record<string, AttendanceStatus> = {};
            data.forEach((s: Student) => { initial[s.id] = s.status; });
            setAttendanceData(initial);
            return data as Student[];
        },
        enabled: !!selectedClass,
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const records = Object.entries(attendanceData)
                .filter(([_, status]) => status !== null)
                .map(([studentId, status]) => ({
                    studentId,
                    status,
                    date: selectedDate,
                }));

            const res = await fetch("/api/attendance/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classId: selectedClass, records }),
            });
            if (!res.ok) throw new Error("Failed to save");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["attendance"] });
            setHasChanges(false);
        },
    });

    const setStatus = (studentId: string, status: AttendanceStatus) => {
        setAttendanceData(prev => ({ ...prev, [studentId]: status }));
        setHasChanges(true);
    };

    const markAllPresent = () => {
        const newData: Record<string, AttendanceStatus> = {};
        students?.forEach(s => { newData[s.id] = "PRESENT"; });
        setAttendanceData(newData);
        setHasChanges(true);
    };

    const changeDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split("T")[0]);
    };

    const stats = {
        present: Object.values(attendanceData).filter(s => s === "PRESENT").length,
        absent: Object.values(attendanceData).filter(s => s === "ABSENT").length,
        late: Object.values(attendanceData).filter(s => s === "LATE").length,
        total: students?.length || 0,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Appel du Jour</h1>
                    <p className="text-muted-foreground">Enregistrez les présences de vos élèves</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={markAllPresent} disabled={!selectedClass}>
                        <Check className="w-4 h-4 mr-2" />
                        Tous présents
                    </Button>
                    {hasChanges && (
                        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Enregistrer
                        </Button>
                    )}
                </div>
            </div>

            {/* Class & Date Selection */}
            <div className="flex flex-wrap gap-4">
                <Card className="flex-1 min-w-[250px]">
                    <CardContent className="pt-6">
                        <label className="text-sm font-medium mb-2 block">Classe</label>
                        <select
                            className="w-full p-2 border rounded-lg"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">Sélectionner une classe</option>
                            {classes?.map((c: { id: string; name: string }) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </CardContent>
                </Card>

                <Card className="flex-1 min-w-[250px]">
                    <CardContent className="pt-6">
                        <label className="text-sm font-medium mb-2 block">Date</label>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => changeDate(-1)}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <input
                                type="date"
                                className="flex-1 p-2 border rounded-lg text-center"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                            <Button variant="ghost" size="sm" onClick={() => changeDate(1)}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stats */}
            {selectedClass && (
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-green-500/10 border-green-500/20">
                        <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
                            <p className="text-sm text-green-600">Présents</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/20">
                        <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                            <p className="text-sm text-red-600">Absents</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-500/10 border-orange-500/20">
                        <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
                            <p className="text-sm text-orange-600">Retards</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/10 border-primary/20">
                        <CardContent className="pt-4 text-center">
                            <p className="text-2xl font-bold text-primary">{stats.total}</p>
                            <p className="text-sm text-primary">Total</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Students List */}
            {!isLoading && selectedClass && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Liste des élèves ({students?.length || 0})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {students?.map((student, index) => {
                                const currentStatus = attendanceData[student.id];

                                return (
                                    <motion.div
                                        key={student.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <p className="font-medium">{student.name}</p>
                                                <p className="text-xs text-muted-foreground">{student.matricule}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {(["PRESENT", "LATE", "ABSENT", "EXCUSED"] as AttendanceStatus[]).map((status) => {
                                                if (!status) return null;
                                                const config = statusConfig[status];
                                                const Icon = config.icon;
                                                const isActive = currentStatus === status;

                                                return (
                                                    <Button
                                                        key={status}
                                                        size="sm"
                                                        variant={isActive ? "default" : "ghost"}
                                                        className={cn(
                                                            "w-10 h-10",
                                                            isActive && config.color
                                                        )}
                                                        onClick={() => setStatus(student.id, status)}
                                                        title={config.label}
                                                    >
                                                        <Icon className="w-4 h-4" />
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No Class Selected */}
            {!selectedClass && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Sélectionnez une classe pour faire l&apos;appel</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
