"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { t } from "@/lib/i18n";

import { Avatar, Button, Card, Icon, Spinner } from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageLoading } from "@/components/layout/page-states";

type RawStudent = {
    id: string;
    matricule?: string;
    user?: { firstName: string | null; lastName: string | null } | null;
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";
type AttendanceRecord = {
    studentId: string;
    studentName: string;
    matricule: string;
    status: AttendanceStatus;
    notes: string;
};

interface ClassOption {
    id: string;
    name: string;
}

const STATUS_BUTTONS: {
    key: AttendanceStatus;
    letter: string;
    label: string;
    bg: string;
    glow: string;
}[] = [
    {
        key: "PRESENT",
        letter: "P",
        label: "Présent",
        bg: "var(--eduflow-success-600)",
        glow: "0 6px 16px rgba(5, 150, 105, 0.35)",
    },
    {
        key: "EXCUSED",
        letter: "E",
        label: "Excusé",
        bg: "var(--eduflow-warning-500)",
        glow: "0 6px 16px rgba(245, 158, 11, 0.35)",
    },
    {
        key: "ABSENT",
        letter: "A",
        label: "Absent",
        bg: "var(--eduflow-danger-600)",
        glow: "0 6px 16px rgba(220, 38, 38, 0.35)",
    },
];

export default function AttendancePage() {
    const router = useRouter();
    useSession();
    const { isFocusMode } = useSidebar();

    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedDate, setSelectedDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(false);

    const [attendanceData, setAttendanceData] = useState<
        Record<string, AttendanceRecord>
    >({});
    const [initialAttendanceData, setInitialAttendanceData] = useState<
        Record<string, AttendanceRecord>
    >({});
    const [orderedStudentIds, setOrderedStudentIds] = useState<string[]>([]);

    const { data: classesData } = useSWR("/api/classes", fetcher);
    useEffect(() => {
        if (classesData)
            setClasses(
                Array.isArray(classesData) ? classesData : classesData.data || []
            );
    }, [classesData]);

    useEffect(() => {
        if (!selectedClassId || !selectedDate) return;

        const fetchData = async () => {
            setIsFetchingData(true);
            try {
                const [stuRes, attRes] = await Promise.all([
                    fetch(`/api/students?classId=${selectedClassId}&limit=1000`),
                    fetch(
                        `/api/attendance/bulk?classId=${selectedClassId}&date=${selectedDate}`
                    ),
                ]);

                const stuData = await stuRes.json();
                const existingRecords: { studentId: string; status: string; reason?: string }[] = attRes.ok
                    ? await attRes.json()
                    : [];

                const studentsList: RawStudent[] = Array.isArray(stuData)
                    ? stuData
                    : stuData.students || [];
                const newAttrMap: Record<string, AttendanceRecord> = {};
                const orderedIds: string[] = [];

                studentsList.forEach((stu) => {
                    orderedIds.push(stu.id);
                    const existing = existingRecords.find(
                        (r) => r.studentId === stu.id
                    );
                    const fullName = `${stu.user?.lastName || ""} ${stu.user?.firstName || ""}`.trim();
                    newAttrMap[stu.id] = {
                        studentId: stu.id,
                        studentName: fullName || "Inconnu",
                        matricule:
                            stu.matricule ?? `00${stu.id.slice(-4).toUpperCase()}`,
                        status: (existing?.status as AttendanceStatus) ?? "PRESENT",
                        notes: existing?.reason ?? "",
                    };
                });

                setAttendanceData(newAttrMap);
                setInitialAttendanceData(newAttrMap);
                setOrderedStudentIds(orderedIds);
            } catch {
                toast({
                    title: "Erreur",
                    description: "Impossible de charger les données",
                    variant: "destructive",
                });
            } finally {
                setIsFetchingData(false);
            }
        };
        fetchData();
    }, [selectedClassId, selectedDate]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setAttendanceData((prev) => ({
            ...prev,
            [studentId]: { ...prev[studentId], status },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const records = Object.values(attendanceData).map((rec) => ({
                studentId: rec.studentId,
                status: rec.status,
                notes: rec.notes,
            }));

            const res = await fetch("/api/attendance/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: selectedClassId,
                    date: selectedDate,
                    records,
                }),
            });

            if (!res.ok) throw new Error("Erreur de sauvegarde");
            setInitialAttendanceData(attendanceData);
            toast({
                title: t("attendance.toasts.savedTitle"),
                description: t("attendance.toasts.savedDescription"),
                action: (
                    <ToastAction
                        altText={t("attendance.toasts.viewAnalytics")}
                        onClick={() => router.push("/dashboard/analytics")}
                    >
                        {t("attendance.toasts.viewAnalytics")}
                    </ToastAction>
                ),
            });
        } catch {
            toast({
                title: "Erreur",
                description: "Erreur lors de la sauvegarde",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const dirtyCount = useMemo(() => {
        return orderedStudentIds.reduce((acc, id) => {
            const current = attendanceData[id];
            const initial = initialAttendanceData[id];
            if (!current || !initial) return acc;
            if (
                current.status !== initial.status ||
                (current.notes || "") !== (initial.notes || "")
            ) {
                return acc + 1;
            }
            return acc;
        }, 0);
    }, [attendanceData, initialAttendanceData, orderedStudentIds]);

    const filteredIds = useMemo(
        () =>
            orderedStudentIds.filter((id) =>
                attendanceData[id]?.studentName
                    .toLowerCase()
                    .includes(searchQuery.toLowerCase())
            ),
        [orderedStudentIds, attendanceData, searchQuery]
    );

    const stats = useMemo(() => {
        const counts = { PRESENT: 0, ABSENT: 0, EXCUSED: 0 };
        Object.values(attendanceData).forEach((curr) => {
            counts[curr.status as AttendanceStatus] = (counts[curr.status as AttendanceStatus] || 0) + 1;
        });
        return counts;
    }, [attendanceData]);

    const totalCount = orderedStudentIds.length;

    const handleAllPresent = () => {
        const next = { ...attendanceData };
        Object.keys(next).forEach((id) => {
            next[id] = { ...next[id], status: "PRESENT" };
        });
        setAttendanceData(next);
    };

    return (
        <PageGuard
            permission={Permission.ATTENDANCE_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"]}
        >
            <PageShell className="max-w-[1200px] pb-32">
                <PageHeader
                    title="Feuille d'appel"
                    description={
                        isFocusMode
                            ? "Mode focus — marquage rapide P / E / A."
                            : "Saisissez les présences quotidiennes par classe et par date."
                    }
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Feuille d'appel" },
                    ]}
                    actions={
                        !isFocusMode ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="cards"
                                onClick={() => window.print()}
                            >
                                Imprimer
                            </Button>
                        ) : undefined
                    }
                />

                {/* Config card */}
                <Card padding={0}>
                    <div className="px-5 py-5">
                        <div
                            className="grid items-end gap-4"
                            style={{
                                gridTemplateColumns:
                                    "minmax(220px, 1.5fr) minmax(180px, 1fr) minmax(280px, 1.4fr)",
                            }}
                        >
                            <FieldSelect
                                label="Classe"
                                value={selectedClassId}
                                onChange={setSelectedClassId}
                                placeholder="Choisir une classe…"
                                options={classes.map((c) => ({
                                    value: c.id,
                                    label: c.name,
                                }))}
                            />
                            <FieldDate
                                label="Date de l'appel"
                                value={selectedDate}
                                onChange={setSelectedDate}
                            />
                            <StatsStrip stats={stats} total={totalCount} />
                        </div>
                    </div>
                </Card>

                {!selectedClassId ? (
                    <PageEmpty
                        icon="check"
                        title="Sélectionnez une classe pour démarrer l'appel"
                        description="Choisissez la classe et la date, puis marquez les présences avec les boutons P / E / A. Enregistrez l'appel via le bouton en bas de page."
                    />
                ) : null}

                {selectedClassId ? (
                    <Card padding={0}>
                        <div
                            className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <div
                                className="flex h-9 items-center gap-2 px-3"
                                style={{
                                    width: "100%",
                                    maxWidth: 280,
                                    background: "var(--eduflow-surface-sunken)",
                                    border: "1px solid transparent",
                                    borderRadius: "var(--eduflow-radius-md)",
                                }}
                            >
                                <Icon
                                    name="search"
                                    size={14}
                                    color="var(--eduflow-text-tertiary)"
                                />
                                <input
                                    type="search"
                                    aria-label="Rechercher un élève dans la classe"
                                    placeholder="Rechercher un élève…"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent outline-none"
                                    style={{
                                        border: 0,
                                        fontFamily: "inherit",
                                        fontSize: 13,
                                        color: "var(--eduflow-text-primary)",
                                    }}
                                />
                            </div>
                            {!isFocusMode && totalCount > 0 ? (
                                <Button
                                    variant="soft"
                                    size="sm"
                                    icon="check"
                                    onClick={handleAllPresent}
                                >
                                    Tous présents
                                </Button>
                            ) : null}
                        </div>

                        {dirtyCount > 0 ? (
                            <div
                                className="flex items-center gap-2 border-b px-5 py-2"
                                style={{
                                    background: "var(--brand-50)",
                                    borderColor: "var(--brand-100)",
                                    color: "var(--brand-800)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                }}
                            >
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        background: "var(--brand-600)",
                                        animation: "eduflowPulse 1.4s ease-in-out infinite",
                                    }}
                                />
                                {dirtyCount} modification
                                {dirtyCount > 1 ? "s" : ""} non enregistrée
                                {dirtyCount > 1 ? "s" : ""}
                            </div>
                        ) : null}

                        {isFetchingData ? (
                            <PageLoading label="Chargement de la feuille d'appel…" />
                        ) : filteredIds.length === 0 ? (
                            <PageEmpty
                                icon="users"
                                title="Aucun élève à afficher"
                                description="Aucun élève ne correspond à la recherche, ou la classe ne contient pas encore d'inscriptions actives."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr
                                            style={{
                                                background: "var(--eduflow-surface-sunken)",
                                                textAlign: "left",
                                            }}
                                        >
                                            <Th>Élève</Th>
                                            <Th width={200} center>
                                                Statut
                                            </Th>
                                            {!isFocusMode ? (
                                                <Th>Observations / Justificatifs</Th>
                                            ) : null}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredIds.map((id, idx) => {
                                            const rec = attendanceData[id];
                                            if (!rec) return null;
                                            const isDirty =
                                                rec.status !== initialAttendanceData[id]?.status ||
                                                rec.notes !== (initialAttendanceData[id]?.notes ?? "");
                                            return (
                                                <tr
                                                    key={id}
                                                    style={{
                                                        borderTop:
                                                            "1px solid var(--eduflow-border-subtle)",
                                                        background: isDirty
                                                            ? "var(--brand-50)"
                                                            : "transparent",
                                                        transition:
                                                            "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                    }}
                                                >
                                                    <td style={{ padding: "12px 20px" }}>
                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className="eduflow-mono"
                                                                style={{
                                                                    width: 24,
                                                                    fontSize: 11,
                                                                    color: "var(--eduflow-text-tertiary)",
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                {idx + 1}
                                                            </span>
                                                            <Avatar name={rec.studentName} size="sm" />
                                                            <div className="min-w-0">
                                                                <div
                                                                    style={{
                                                                        fontSize: 13,
                                                                        fontWeight: 600,
                                                                        color: "var(--eduflow-text-primary)",
                                                                    }}
                                                                >
                                                                    {rec.studentName}
                                                                </div>
                                                                <div
                                                                    className="eduflow-mono"
                                                                    style={{
                                                                        fontSize: 10,
                                                                        color: "var(--eduflow-text-tertiary)",
                                                                        textTransform: "uppercase",
                                                                    }}
                                                                >
                                                                    {rec.matricule}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "12px 20px" }}>
                                                        <div className="flex items-center justify-center gap-2">
                                                            {STATUS_BUTTONS.map((b) => (
                                                                <StatusButton
                                                                    key={b.key}
                                                                    active={rec.status === b.key}
                                                                    letter={b.letter}
                                                                    label={b.label}
                                                                    bg={b.bg}
                                                                    glow={b.glow}
                                                                    onClick={() =>
                                                                        handleStatusChange(id, b.key)
                                                                    }
                                                                />
                                                            ))}
                                                        </div>
                                                    </td>
                                                    {!isFocusMode ? (
                                                        <td style={{ padding: "12px 20px" }}>
                                                            <input
                                                                aria-label={`Observation pour ${rec.studentName}`}
                                                                value={rec.notes}
                                                                onChange={(e) =>
                                                                    setAttendanceData((p) => ({
                                                                        ...p,
                                                                        [id]: {
                                                                            ...p[id],
                                                                            notes: e.target.value,
                                                                        },
                                                                    }))
                                                                }
                                                                placeholder="Justificatif…"
                                                                style={{
                                                                    width: "100%",
                                                                    height: 32,
                                                                    padding: "0 10px",
                                                                    border:
                                                                        "1px solid var(--eduflow-border-default)",
                                                                    borderRadius: 8,
                                                                    background:
                                                                        "var(--eduflow-surface-card)",
                                                                    fontFamily: "inherit",
                                                                    fontSize: 12,
                                                                    color: "var(--eduflow-text-primary)",
                                                                    outline: "none",
                                                                }}
                                                            />
                                                        </td>
                                                    ) : null}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                ) : null}

                {/* Sticky save bar — full-width pill, brand-tinted shadow */}
                {selectedClassId && filteredIds.length > 0 ? (
                    <div
                        className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4"
                        style={{ pointerEvents: saving ? "none" : "auto" }}
                    >
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || dirtyCount === 0}
                            className="touch-target flex w-full items-center justify-center gap-2"
                            style={{
                                height: 52,
                                padding: "0 24px",
                                border: 0,
                                borderRadius: "var(--eduflow-radius-pill)",
                                background:
                                    dirtyCount === 0
                                        ? "var(--eduflow-neutral-300)"
                                        : "var(--brand-700)",
                                color: "var(--eduflow-text-on-brand)",
                                fontFamily: "inherit",
                                fontSize: 13,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                cursor:
                                    saving || dirtyCount === 0 ? "not-allowed" : "pointer",
                                opacity: saving ? 0.7 : 1,
                                boxShadow:
                                    dirtyCount > 0
                                        ? "var(--eduflow-shadow-cta)"
                                        : "var(--eduflow-shadow-sm)",
                                transition:
                                    "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                            }}
                        >
                            {saving ? (
                                <Spinner size={18} color="#fff" />
                            ) : (
                                <Icon name="check" size={18} />
                            )}
                            {dirtyCount > 0
                                ? t("common.saveWithCount", { count: dirtyCount })
                                : t("common.noChanges")}
                        </button>
                    </div>
                ) : null}
            </PageShell>
        </PageGuard>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusButton({
    active,
    letter,
    label,
    bg,
    glow,
    onClick,
}: {
    active: boolean;
    letter: string;
    label: string;
    bg: string;
    glow: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className="touch-target flex items-center justify-center"
            style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: active ? 0 : "1.5px solid var(--eduflow-border-default)",
                background: active ? bg : "transparent",
                color: active ? "#fff" : "var(--eduflow-text-tertiary)",
                fontFamily: "inherit",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: active ? glow : "none",
                transform: active ? "scale(1.06)" : "scale(1)",
                transition:
                    "transform var(--eduflow-motion-tap) var(--eduflow-ease-spring), background var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            {letter}
        </button>
    );
}

function StatsStrip({
    stats,
    total,
}: {
    stats: { PRESENT: number; ABSENT: number; EXCUSED: number };
    total: number;
}) {
    const items: { key: AttendanceStatus; label: string; tone: "success" | "danger" | "warning" }[] = [
        { key: "PRESENT", label: "Présents", tone: "success" },
        { key: "EXCUSED", label: "Excusés", tone: "warning" },
        { key: "ABSENT", label: "Absents", tone: "danger" },
    ];
    return (
        <div
            className="grid items-center gap-2"
            style={{
                gridTemplateColumns: "repeat(3, 1fr)",
                background: "var(--eduflow-surface-sunken)",
                border: "1px solid var(--eduflow-border-subtle)",
                borderRadius: "var(--eduflow-radius-md)",
                padding: "8px 6px",
            }}
        >
            {items.map((item) => {
                const count = stats[item.key] ?? 0;
                const ratio = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                    <div key={item.key} className="px-2 text-center">
                        <div
                            style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: `var(--eduflow-${item.tone}-700)`,
                            }}
                        >
                            {item.label}
                        </div>
                        <div
                            className="eduflow-display eduflow-tabular"
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                lineHeight: 1.05,
                            }}
                        >
                            {count}
                        </div>
                        <div
                            style={{
                                fontSize: 9,
                                color: "var(--eduflow-text-tertiary)",
                            }}
                        >
                            {total > 0 ? `${ratio}%` : "—"}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value ? 600 : 500,
                    color: value
                        ? "var(--eduflow-text-primary)"
                        : "var(--eduflow-text-tertiary)",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function FieldDate({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <div
                className="flex h-[38px] items-center gap-2 px-3"
                style={{
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <Icon name="calendar" size={14} color="var(--eduflow-text-tertiary)" />
                <input
                    aria-label={label}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 bg-transparent outline-none"
                    style={{
                        border: 0,
                        fontFamily: "inherit",
                        fontSize: 13,
                        color: "var(--eduflow-text-primary)",
                    }}
                />
            </div>
        </label>
    );
}

function Th({
    children,
    width,
    center,
}: {
    children: React.ReactNode;
    width?: number;
    center?: boolean;
}) {
    return (
        <th
            style={{
                padding: "10px 20px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--eduflow-text-tertiary)",
                textAlign: center ? "center" : "left",
                width,
            }}
        >
            {children}
        </th>
    );
}

