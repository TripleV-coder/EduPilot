"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ChevronLeft, ChevronRight, Clock, MapPin, User, Calendar as CalendarIcon,
    Loader2, Plus, AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

const COLORS = [
    "bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300",
    "bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300",
    "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300",
    "bg-orange-100 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300",
    "bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300",
    "bg-teal-100 border-teal-200 text-teal-700 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-300",
    "bg-pink-100 border-pink-200 text-pink-700 dark:bg-pink-900/30 dark:border-pink-800 dark:text-pink-300",
];

interface ScheduleEvent {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    subject: string;
    room: string;
    teacher: string;
    classId: string;
    className: string;
}

interface ScheduleSlot {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
    classSubject?: {
        subject: { name: string };
        teacher: { user: { firstName: string; lastName: string } };
        class: { name: string };
    };
}

export default function SchedulePage() {
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
    const [selectedClass, setSelectedClass] = useState<string>("");

    // Get current week dates
    const getWeekDates = () => {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1 + (currentWeekOffset * 7));
        return {
            start: monday,
            end: new Date(monday.getTime() + 4 * 24 * 60 * 60 * 1000),
            display: `Semaine du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
        };
    };

    const weekInfo = getWeekDates();

    // Fetch classes
    const { data: classes } = useQuery({
        queryKey: ["classes"],
        queryFn: async () => {
            const res = await fetch("/api/classes");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch schedule
    const { data: scheduleData, isLoading } = useQuery({
        queryKey: ["schedule", selectedClass],
        queryFn: async () => {
            const url = selectedClass
                ? `/api/schedules?classId=${selectedClass}`
                : "/api/schedules";
            const res = await fetch(url);
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Transform API data to events
    const events: ScheduleEvent[] = (scheduleData || []).map((slot: ScheduleSlot, index: number) => ({
        id: slot.id,
        day: DAYS[slot.dayOfWeek - 1] || DAYS[0],
        startTime: slot.startTime.substring(0, 5),
        endTime: slot.endTime.substring(0, 5),
        subject: slot.classSubject?.subject?.name || "Cours",
        room: slot.room || "Salle",
        teacher: slot.classSubject?.teacher?.user
            ? `${slot.classSubject.teacher.user.firstName} ${slot.classSubject.teacher.user.lastName}`
            : "Enseignant",
        classId: slot.classSubject?.class?.name || "",
        className: slot.classSubject?.class?.name || "",
        color: COLORS[index % COLORS.length],
    }));

    const getEventStyle = (startTime: string, endTime: string) => {
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        const duration = endHour - startHour;
        const rowStart = startHour - 8 + 2;
        return {
            gridRow: `${rowStart} / span ${Math.max(1, duration)}`,
        };
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Emploi du Temps</h1>
                    <p className="text-muted-foreground">Planning hebdomadaire des cours</p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Class Filter */}
                    <select
                        className="p-2 border rounded-lg bg-background min-w-[180px]"
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                    >
                        <option value="">Toutes les classes</option>
                        {classes?.map((c: { id: string; name: string }) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    {/* Week Navigation */}
                    <div className="flex items-center bg-muted rounded-lg p-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 text-sm font-medium flex items-center gap-2 min-w-[200px] justify-center">
                            <CalendarIcon className="h-4 w-4" />
                            {weekInfo.display}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter
                    </Button>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Schedule Grid */}
            {!isLoading && (
                <Card className="flex-1 overflow-auto border rounded-xl">
                    <CardContent className="p-4">
                        {events.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                                <h3 className="font-bold text-lg mb-2">Aucun cours programmé</h3>
                                <p className="text-muted-foreground mb-4">
                                    {selectedClass
                                        ? "Aucun cours trouvé pour cette classe"
                                        : "Sélectionnez une classe ou ajoutez des cours"}
                                </p>
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Créer un emploi du temps
                                </Button>
                            </div>
                        ) : (
                            <div className="min-w-[800px]">
                                <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-2">
                                    {/* Header Row */}
                                    <div className="h-12 border-b"></div>
                                    {DAYS.map((day, i) => (
                                        <motion.div
                                            key={day}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="h-12 border-b flex items-center justify-center font-semibold text-sm uppercase tracking-wide text-muted-foreground"
                                        >
                                            {day}
                                        </motion.div>
                                    ))}

                                    {/* Time Column */}
                                    <div className="grid grid-rows-[repeat(10,5rem)]">
                                        {HOURS.map((hour) => (
                                            <div key={hour} className="relative h-20 text-xs text-muted-foreground font-medium -top-2.5 text-right pr-2">
                                                {hour}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Days Columns */}
                                    {DAYS.map((day) => {
                                        const dayEvents = events.filter(e => e.day === day);

                                        return (
                                            <div key={day} className="relative grid grid-rows-[repeat(10,5rem)] border-l">
                                                {/* Grid Lines */}
                                                {HOURS.map((_, i) => (
                                                    <div key={i} className="border-b border-dashed border-gray-100 dark:border-gray-800 h-20 w-full" />
                                                ))}

                                                {/* Events */}
                                                {dayEvents.map((event, eventIndex) => {
                                                    const style = getEventStyle(event.startTime, event.endTime);
                                                    return (
                                                        <motion.div
                                                            key={event.id}
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            transition={{ delay: eventIndex * 0.05 }}
                                                            style={style}
                                                            className={cn(
                                                                "absolute w-[95%] left-[2.5%] rounded-lg border p-3 flex flex-col justify-between shadow-sm cursor-pointer hover:scale-[1.02] transition-transform",
                                                                COLORS[eventIndex % COLORS.length]
                                                            )}
                                                        >
                                                            <div className="font-semibold text-sm truncate">{event.subject}</div>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center text-xs opacity-80 gap-1.5">
                                                                    <Clock className="w-3 h-3" /> {event.startTime} - {event.endTime}
                                                                </div>
                                                                <div className="flex items-center text-xs opacity-80 gap-1.5">
                                                                    <MapPin className="w-3 h-3" /> {event.room}
                                                                </div>
                                                                <div className="flex items-center text-xs opacity-80 gap-1.5">
                                                                    <User className="w-3 h-3" /> {event.teacher}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
