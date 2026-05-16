"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";

import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { Permission } from "@/lib/rbac/permissions";
import { t } from "@/lib/i18n";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    type IconName,
} from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type Student = {
    id: string;
    studentNumber?: string;
    matricule?: string;
    user?: {
        firstName: string;
        lastName: string;
        email: string;
        isActive: boolean;
    };
    enrollments?: {
        class?: {
            name: string;
        };
    }[];
};

type ClassOption = { id: string; name: string };

type StudentResponse = {
    data?: Student[];
    students?: Student[];
    pagination?: { total?: number; totalPages?: number };
};

type ClassesResponse = { data?: ClassOption[]; classes?: ClassOption[] };

const PAGE_SIZE = 30;

export default function StudentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 500);
    const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(
        null
    );
    const [isDeleting, setIsDeleting] = useState(false);

    const queryParams = new URLSearchParams();
    queryParams.set("limit", String(PAGE_SIZE));
    queryParams.set("page", String(currentPage));
    if (selectedClassId !== "ALL") queryParams.set("classId", selectedClassId);
    if (selectedStatus !== "ALL") queryParams.set("status", selectedStatus);
    if (debouncedSearch) queryParams.set("search", debouncedSearch);

    const {
        data: response,
        error,
        isLoading: loading,
    } = useSWR<StudentResponse | Student[]>(
        `/api/students?${queryParams.toString()}`,
        fetcher
    );
    const { data: classesData } = useSWR<ClassesResponse | ClassOption[]>(
        "/api/classes",
        fetcher
    );

    const { mutate } = useSWRConfig();
    const { toast } = useToast();

    const students: Student[] = Array.isArray(response)
        ? response
        : response?.data ?? response?.students ?? [];
    const pagination = !Array.isArray(response) ? response?.pagination : undefined;
    const totalStudents = pagination?.total ?? students.length;
    const totalPages = pagination?.totalPages ?? 1;
    const classes: ClassOption[] = Array.isArray(classesData)
        ? classesData
        : classesData?.data ?? classesData?.classes ?? [];

    const activeFiltersCount = [
        selectedClassId !== "ALL",
        selectedStatus !== "ALL",
        !!searchTerm.trim(),
    ].filter(Boolean).length;

    const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
        setter(val);
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedClassId("ALL");
        setSelectedStatus("ALL");
        setCurrentPage(1);
    };

    const handleExportCSV = () => {
        if (!students || students.length === 0) {
            toast({
                title: "Export impossible",
                description: "Aucune donnée à exporter.",
                variant: "destructive",
            });
            return;
        }
        const headers = ["Matricule", "Nom", "Prénom", "Classe", "Statut d'inscription"];
        const rows = students.map((s) => {
            const className =
                Array.isArray(s.enrollments) && s.enrollments.length > 0
                    ? s.enrollments[0].class?.name
                    : "Non assigné";
            return [
                s.matricule || s.studentNumber || "",
                s.user?.lastName || "",
                s.user?.firstName || "",
                className || "",
                s.user?.isActive ? "Actif" : "Inactif",
            ];
        });
        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute(
            "download",
            `eleves_export_${new Date().toISOString().split("T")[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const requestDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.preventDefault();
        e.stopPropagation();
        setPendingDelete({ id, name });
        setDeleteDialogOpen(true);
    };

    const markStudentTransition = (studentId: string) => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem("edupilot-student-transition", studentId);
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/students/${pendingDelete.id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            toast({ title: "Succès", description: "L'élève a été supprimé." });
            setDeleteDialogOpen(false);
            setPendingDelete(null);
            mutate(`/api/students?${queryParams.toString()}`);
        } catch (err) {
            toast({
                title: "Erreur",
                description: err instanceof Error ? err.message : "Erreur inconnue",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const deleteDialogTitle = pendingDelete
        ? `Supprimer ${pendingDelete.name} ?`
        : "Supprimer cet élève ?";

    return (
        <PageGuard
            permission={[Permission.STUDENT_READ, Permission.STUDENT_READ_OWN]}
            roles={[
                "SUPER_ADMIN",
                "SCHOOL_ADMIN",
                "DIRECTOR",
                "TEACHER",
                "ACCOUNTANT",
                "PARENT",
                "STUDENT",
            ]}
        >
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Élèves"
                        sub={`${totalStudents} ${totalStudents > 1 ? "élèves enregistrés" : "élève enregistré"} dans l'établissement`}
                        actions={
                            <>
                                <SegmentedToggle
                                    value={viewMode}
                                    onChange={setViewMode}
                                    options={[
                                        { value: "grid", label: "Grille", icon: "grid" },
                                        { value: "table", label: "Tableau", icon: "cards" },
                                    ]}
                                />
                                <RoleActionGuard
                                    allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                                >
                                    <Button variant="ghost" icon="download" onClick={handleExportCSV}>
                                        {t("common.exportCsv")}
                                    </Button>
                                    <Link href="/dashboard/import">
                                        <Button variant="secondary" icon="download">
                                            {t("common.import")}
                                        </Button>
                                    </Link>
                                    <Link href="/dashboard/students/new">
                                        <Button icon="plus">Inscrire un élève</Button>
                                    </Link>
                                </RoleActionGuard>
                            </>
                        }
                    />
                </div>

                {/* Filters */}
                <Card padding={14}>
                    <div
                        className="grid items-end gap-3"
                        style={{
                            gridTemplateColumns:
                                "minmax(220px, 1fr) minmax(160px, 200px) minmax(140px, 180px) auto",
                        }}
                    >
                        <FieldSearch
                            label="Rechercher"
                            value={searchTerm}
                            onChange={(v) => {
                                setSearchTerm(v);
                                setCurrentPage(1);
                            }}
                            placeholder="Nom, prénom, matricule…"
                        />
                        <FieldSelect
                            label="Classe"
                            value={selectedClassId}
                            onChange={handleFilterChange(setSelectedClassId)}
                            options={[
                                { value: "ALL", label: "Toutes les classes" },
                                ...classes.map((c) => ({ value: c.id, label: c.name })),
                            ]}
                            placeholder="Toutes les classes"
                        />
                        <FieldSelect
                            label="Statut"
                            value={selectedStatus}
                            onChange={handleFilterChange(setSelectedStatus)}
                            options={[
                                { value: "ALL", label: "Tous les statuts" },
                                { value: "ACTIVE", label: "Actif" },
                                { value: "INACTIVE", label: "Inactif" },
                            ]}
                            placeholder="Tous les statuts"
                        />
                        {activeFiltersCount > 0 ? (
                            <Button variant="ghost" size="sm" icon="x" onClick={resetFilters}>
                                Réinitialiser ({activeFiltersCount})
                            </Button>
                        ) : (
                            <div />
                        )}
                    </div>
                </Card>

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                Impossible de charger les élèves.
                            </p>
                        </div>
                    </Card>
                ) : null}

                {loading ? <SkeletonGrid /> : null}

                {!loading && !error && students.length === 0 ? (
                    <Card padding={36}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div
                                className="grid place-items-center"
                                style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 16,
                                    background: "var(--brand-50)",
                                }}
                            >
                                <Icon name="users" size={26} color="var(--brand-700)" />
                            </div>
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Aucun élève trouvé
                            </h3>
                            <p
                                style={{
                                    fontSize: 13,
                                    color: "var(--eduflow-text-secondary)",
                                    maxWidth: 480,
                                    lineHeight: 1.55,
                                    margin: 0,
                                }}
                            >
                                {activeFiltersCount > 0
                                    ? "Aucun élève ne correspond aux filtres actuels. Essaie d'élargir la recherche."
                                    : "Inscris des élèves manuellement ou via import. Une fois inscrits, tu pourras suivre leur présence, leurs notes et leurs documents."}
                            </p>
                            <div className="mt-2 flex flex-wrap justify-center gap-2">
                                {activeFiltersCount > 0 ? (
                                    <Button variant="secondary" icon="x" onClick={resetFilters}>
                                        Réinitialiser les filtres
                                    </Button>
                                ) : (
                                    <RoleActionGuard
                                        allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                                    >
                                        <Link href="/dashboard/import">
                                            <Button variant="secondary" icon="download">
                                                Importer
                                            </Button>
                                        </Link>
                                        <Link href="/dashboard/students/new">
                                            <Button icon="plus">Inscrire un élève</Button>
                                        </Link>
                                    </RoleActionGuard>
                                )}
                            </div>
                        </div>
                    </Card>
                ) : null}

                {!loading && !error && students.length > 0 && viewMode === "grid" ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {students.map((student) => (
                            <StudentCard
                                key={student.id}
                                student={student}
                                onRequestDelete={(e) => {
                                    const name = student.user
                                        ? `${student.user.firstName} ${student.user.lastName}`
                                        : student.studentNumber ?? student.matricule ?? "—";
                                    requestDelete(e, student.id, name);
                                }}
                                onNavigate={() => markStudentTransition(student.id)}
                            />
                        ))}
                    </div>
                ) : null}

                {!loading && !error && students.length > 0 && viewMode === "table" ? (
                    <Card padding={0}>
                        <div className="overflow-x-auto">
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr
                                        style={{
                                            background: "var(--eduflow-surface-sunken)",
                                            textAlign: "left",
                                        }}
                                    >
                                        <Th width={140}>Matricule</Th>
                                        <Th>Élève</Th>
                                        <Th>Classe</Th>
                                        <Th width={120}>Statut</Th>
                                        <Th width={100} center>
                                            Actions
                                        </Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student) => {
                                        const fullName = student.user
                                            ? `${student.user.firstName} ${student.user.lastName}`
                                            : student.studentNumber ?? student.matricule ?? "—";
                                        const className =
                                            Array.isArray(student.enrollments) &&
                                            student.enrollments.length > 0
                                                ? student.enrollments[0].class?.name
                                                : null;
                                        return (
                                            <tr
                                                key={student.id}
                                                style={{
                                                    borderTop: "1px solid var(--eduflow-border-subtle)",
                                                    transition:
                                                        "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                                }}
                                            >
                                                <Td>
                                                    <span
                                                        className="eduflow-mono"
                                                        style={{
                                                            fontSize: 11,
                                                            color: "var(--eduflow-text-tertiary)",
                                                            textTransform: "uppercase",
                                                        }}
                                                    >
                                                        {student.matricule || student.studentNumber || "—"}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar name={fullName} size="sm" />
                                                        <div className="min-w-0">
                                                            <div
                                                                style={{
                                                                    fontSize: 13,
                                                                    fontWeight: 600,
                                                                    color: "var(--eduflow-text-primary)",
                                                                }}
                                                            >
                                                                {fullName}
                                                            </div>
                                                            {student.user?.email ? (
                                                                <div
                                                                    className="truncate"
                                                                    style={{
                                                                        fontSize: 11,
                                                                        color:
                                                                            "var(--eduflow-text-tertiary)",
                                                                    }}
                                                                >
                                                                    {student.user.email}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    {className ? (
                                                        <Badge variant="brand" size="sm">
                                                            {className}
                                                        </Badge>
                                                    ) : (
                                                        <span
                                                            style={{
                                                                fontSize: 12,
                                                                color: "var(--eduflow-text-tertiary)",
                                                            }}
                                                        >
                                                            Non assigné
                                                        </span>
                                                    )}
                                                </Td>
                                                <Td>
                                                    {student.user?.isActive ? (
                                                        <Badge variant="success" size="sm" dot>
                                                            Actif
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="neutral" size="sm">
                                                            Inactif
                                                        </Badge>
                                                    )}
                                                </Td>
                                                <Td center>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Link
                                                            href={`/dashboard/students/${student.id}`}
                                                            onClick={() =>
                                                                markStudentTransition(student.id)
                                                            }
                                                            aria-label="Voir l'élève"
                                                        >
                                                            <Button variant="ghost" size="sm" icon="search">
                                                                {""}
                                                            </Button>
                                                        </Link>
                                                        <RoleActionGuard
                                                            allowedRoles={[
                                                                "SUPER_ADMIN",
                                                                "SCHOOL_ADMIN",
                                                                "DIRECTOR",
                                                            ]}
                                                        >
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                icon="x"
                                                                onClick={(e) =>
                                                                    requestDelete(
                                                                        e,
                                                                        student.id,
                                                                        fullName
                                                                    )
                                                                }
                                                            >
                                                                {""}
                                                            </Button>
                                                        </RoleActionGuard>
                                                    </div>
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : null}

                {/* Pagination */}
                {!loading && !error && totalStudents > 0 ? (
                    <div
                        className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                    >
                        <p
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                margin: 0,
                            }}
                        >
                            <span className="eduflow-tabular">{totalStudents}</span> élève
                            {totalStudents > 1 ? "s" : ""} au total — Page{" "}
                            <span className="eduflow-tabular">{currentPage}</span> sur{" "}
                            <span className="eduflow-tabular">{totalPages}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                <span style={{ transform: "scaleX(-1)" }}>
                                    <Icon name="chevron" size={13} />
                                </span>
                                <span>Précédent</span>
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                iconRight="chevron"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                            >
                                Suivant
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>

            <ConfirmActionDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setPendingDelete(null);
                }}
                title={deleteDialogTitle}
                description="Cette action est définitive. Les données liées (inscriptions, historique) peuvent être affectées."
                confirmLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
                variant="destructive"
                isConfirmLoading={isDeleting}
                onConfirm={confirmDelete}
            />
        </PageGuard>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StudentCard({
    student,
    onRequestDelete,
    onNavigate,
}: {
    student: Student;
    onRequestDelete: (e: React.MouseEvent) => void;
    onNavigate: () => void;
}) {
    const fullName = student.user
        ? `${student.user.firstName} ${student.user.lastName}`
        : student.studentNumber ?? student.matricule ?? "—";
    const className =
        Array.isArray(student.enrollments) && student.enrollments.length > 0
            ? student.enrollments[0].class?.name
            : null;
    const isActive = student.user?.isActive ?? false;

    return (
        <Link
            href={`/dashboard/students/${student.id}`}
            onClick={onNavigate}
            style={{ textDecoration: "none", color: "inherit" }}
        >
            <Card
                padding={16}
                style={{
                    cursor: "pointer",
                    transition:
                        "transform var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out), border-color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                }}
                className="hover:-translate-y-0.5 hover:shadow-eduflow-card-brand"
            >
                <div className="flex items-start gap-3">
                    <Avatar
                        name={fullName}
                        size="md"
                        status={isActive ? "online" : undefined}
                    />
                    <div className="min-w-0 flex-1">
                        <div
                            className="truncate"
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                lineHeight: 1.2,
                            }}
                        >
                            {fullName}
                        </div>
                        {student.user?.email ? (
                            <div
                                className="truncate"
                                style={{
                                    fontSize: 11,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginTop: 2,
                                }}
                            >
                                {student.user.email}
                            </div>
                        ) : null}
                        {student.matricule || student.studentNumber ? (
                            <div
                                className="eduflow-mono"
                                style={{
                                    fontSize: 10,
                                    color: "var(--eduflow-text-tertiary)",
                                    textTransform: "uppercase",
                                    marginTop: 4,
                                }}
                            >
                                {student.matricule ?? student.studentNumber}
                            </div>
                        ) : null}
                    </div>
                    <RoleActionGuard
                        allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                    >
                        <button
                            type="button"
                            onClick={onRequestDelete}
                            aria-label="Supprimer l'élève"
                            className="grid place-items-center"
                            style={{
                                width: 30,
                                height: 30,
                                border: 0,
                                background: "transparent",
                                borderRadius: 8,
                                color: "var(--eduflow-text-tertiary)",
                                cursor: "pointer",
                                transition:
                                    "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                    "var(--eduflow-danger-50)";
                                e.currentTarget.style.color = "var(--eduflow-danger-700)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "var(--eduflow-text-tertiary)";
                            }}
                        >
                            <Icon name="x" size={14} />
                        </button>
                    </RoleActionGuard>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {className ? (
                        <Badge variant="brand" size="sm">
                            {className}
                        </Badge>
                    ) : (
                        <Badge variant="neutral" size="sm">
                            Non assigné
                        </Badge>
                    )}
                    {isActive ? (
                        <Badge variant="success" size="sm" dot>
                            Actif
                        </Badge>
                    ) : (
                        <Badge variant="neutral" size="sm">
                            Inactif
                        </Badge>
                    )}
                </div>
            </Card>
        </Link>
    );
}

function SkeletonGrid() {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 14,
            }}
        >
            {Array.from({ length: 8 }).map((_, idx) => (
                <Card key={idx} padding={16}>
                    <div className="flex items-start gap-3">
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: "var(--eduflow-surface-sunken)",
                            }}
                        />
                        <div className="flex-1 space-y-2">
                            <div
                                style={{
                                    height: 14,
                                    width: "70%",
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: 4,
                                }}
                            />
                            <div
                                style={{
                                    height: 10,
                                    width: "50%",
                                    background: "var(--eduflow-surface-sunken)",
                                    borderRadius: 4,
                                }}
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <div
                            style={{
                                height: 18,
                                width: 70,
                                background: "var(--eduflow-surface-sunken)",
                                borderRadius: 9,
                            }}
                        />
                        <div
                            style={{
                                height: 18,
                                width: 50,
                                background: "var(--eduflow-surface-sunken)",
                                borderRadius: 9,
                            }}
                        />
                    </div>
                </Card>
            ))}
        </div>
    );
}

function SegmentedToggle<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; icon: IconName }[];
}) {
    return (
        <div
            className="flex gap-1 rounded-md p-1"
            style={{
                background: "var(--eduflow-surface-sunken)",
                border: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                            background: active ? "var(--eduflow-surface-card)" : "transparent",
                            border: 0,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            color: active
                                ? "var(--brand-700)"
                                : "var(--eduflow-text-secondary)",
                            boxShadow: active ? "var(--eduflow-shadow-sm)" : "none",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        <Icon name={opt.icon} size={13} />
                        {opt.label}
                    </button>
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
    disabled,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    disabled?: boolean;
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
                disabled={disabled}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: value && value !== "ALL" ? 600 : 500,
                    color:
                        value && value !== "ALL"
                            ? "var(--eduflow-text-primary)"
                            : "var(--eduflow-text-secondary)",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
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

function FieldSearch({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
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
            <div
                className="flex h-[38px] items-center gap-2 px-3"
                style={{
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <Icon name="search" size={14} color="var(--eduflow-text-tertiary)" />
                <input
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={label}
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
                padding: "10px 16px",
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

function Td({
    children,
    style,
    center,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    center?: boolean;
}) {
    return (
        <td
            style={{
                padding: "12px 16px",
                fontSize: 13,
                textAlign: center ? "center" : "left",
                ...style,
            }}
        >
            {children}
        </td>
    );
}

