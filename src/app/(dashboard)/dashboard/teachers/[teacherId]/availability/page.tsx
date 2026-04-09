"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Save, CalendarCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";

interface Availability {
    id: string;
    teacherId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAY_INDICES = [1, 2, 3, 4, 5, 6]; // Monday=1 ... Saturday=6

const PERIODS = [
    { id: "p1", start: "08:00", end: "10:00", label: "08h00 - 10h00" },
    { id: "p2", start: "10:00", end: "12:00", label: "10h00 - 12h00" },
    { id: "break", start: "12:00", end: "13:00", label: "12h00 - 13h00 (Pause)", isBreak: true },
    { id: "p3", start: "13:00", end: "15:00", label: "13h00 - 15h00" },
    { id: "p4", start: "15:00", end: "17:00", label: "15h00 - 17h00" },
];

type SlotKey = `${number}-${string}`;

export default function TeacherAvailabilityPage({ params }: { params: { teacherId: string } }) {
    const { data, isLoading, mutate } = useSWR<{ availabilities: Availability[] }>(
        `/api/teachers/${params.teacherId}/availability`,
        fetcher,
        { revalidateOnFocus: false }
    );

    // Build a set of active slots from API data
    const [activeSlots, setActiveSlots] = useState<Set<SlotKey>>(new Set());
    const [slotIdMap, setSlotIdMap] = useState<Map<SlotKey, string>>(new Map());
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (!data?.availabilities) return;
        const slots = new Set<SlotKey>();
        const idMap = new Map<SlotKey, string>();
        for (const a of data.availabilities) {
            if (a.isActive) {
                const key: SlotKey = `${a.dayOfWeek}-${a.startTime}`;
                slots.add(key);
                idMap.set(key, a.id);
            }
        }
        setActiveSlots(slots);
        setSlotIdMap(idMap);
        setDirty(false);
    }, [data]);

    const toggleSlot = useCallback((dayOfWeek: number, startTime: string) => {
        const key: SlotKey = `${dayOfWeek}-${startTime}`;
        setActiveSlots(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
        setDirty(true);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Delete all existing slots, then recreate active ones
            const existingIds = Array.from(slotIdMap.values());
            for (const id of existingIds) {
                await fetch(`/api/teachers/${params.teacherId}/availability?availabilityId=${id}`, {
                    method: "DELETE",
                    credentials: "include",
                });
            }

            // Create active slots
            for (const key of activeSlots) {
                const [dayStr, startTime] = key.split("-") as [string, string];
                const dayOfWeek = parseInt(dayStr);
                const period = PERIODS.find(p => p.start === startTime);
                if (!period || period.isBreak) continue;

                await fetch(`/api/teachers/${params.teacherId}/availability`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        dayOfWeek,
                        startTime: period.start,
                        endTime: period.end,
                        isActive: true,
                    }),
                });
            }

            await mutate();
            toast.success("Disponibilités enregistrées avec succès");
            setDirty(false);
        } catch {
            toast.error("Erreur lors de l'enregistrement");
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader
                    title="Disponibilités Enseignant"
                    description="Cliquez sur les créneaux pour définir la disponibilité. Les changements sont enregistrés en cliquant sur Enregistrer."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Enseignants", href: "/dashboard/teachers" },
                        { label: "Disponibilités" },
                    ]}
                />

                <Card className="border-border shadow-sm border-t-4 border-t-primary">
                    <CardHeader className="bg-muted/10 border-b border-border">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarCheck className="w-5 h-5 text-primary" />
                            Grille Hebdomadaire
                        </CardTitle>
                        <CardDescription>
                            Cliquez sur les créneaux pour basculer entre &quot;Disponible&quot; (Vert) et &quot;Indisponible&quot; (Gris).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 overflow-x-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                            </div>
                        ) : (
                            <div className="min-w-[700px]">
                                <div className="grid grid-cols-7 gap-2 mb-2 font-medium text-sm text-center text-muted-foreground">
                                    <div className="p-2 border border-transparent">Heures</div>
                                    {DAYS.map(d => (
                                        <div key={d} className="p-2 bg-muted/50 rounded border border-border">{d}</div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    {PERIODS.map(period => (
                                        <div key={period.id} className={`grid grid-cols-7 gap-2 ${period.isBreak ? "opacity-50" : ""}`}>
                                            <div className="p-2 flex items-center justify-center font-medium text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3 mr-1" /> {period.label}
                                            </div>

                                            {period.isBreak ? (
                                                <div className="col-span-6 p-2 bg-muted/30 border border-dashed border-border rounded flex items-center justify-center text-xs text-muted-foreground">
                                                    Pause Déjeuner
                                                </div>
                                            ) : (
                                                DAY_INDICES.map((dayIdx, i) => {
                                                    const key: SlotKey = `${dayIdx}-${period.start}`;
                                                    const isActive = activeSlots.has(key);
                                                    return (
                                                        <div
                                                            key={`${DAYS[i]}-${period.id}`}
                                                            onClick={() => toggleSlot(dayIdx, period.start)}
                                                            className={`p-3 border rounded transition-colors cursor-pointer flex items-center justify-center text-xs font-medium select-none ${
                                                                isActive
                                                                    ? "border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:brightness-95"
                                                                    : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                                            }`}
                                                        >
                                                            {isActive ? "Disponible" : "Indisponible"}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                            {dirty && (
                                <p className="text-sm text-[hsl(var(--warning))] font-medium">
                                    Modifications non enregistrées
                                </p>
                            )}
                            <div className="ml-auto">
                                <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Enregistrer la grille
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
