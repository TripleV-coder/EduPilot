"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageLoading } from "@/components/layout/page-states";
import { Badge, Button, Card, Icon } from "@/components/edu";
import { Permission } from "@/lib/rbac/permissions";
import { fetcher } from "@/lib/fetcher";
import { t } from "@/lib/i18n";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Student = {
    id: string;
    user: { firstName: string; lastName: string };
    matricule: string;
};

export default function DocumentGeneratorPage() {
    const [selectedStudent, setSelectedStudent] = useState("");
    const [selectedDoc, setSelectedDoc] = useState("CERTIFICATE_ENROLLMENT");
    const [generating, setGenerating] = useState(false);

    const { data, isLoading } = useSWR<{ students?: Student[] }>("/api/students", fetcher);
    const students = data?.students ?? [];

    const handleGenerate = async () => {
        if (!selectedStudent) {
            toast.error("Veuillez sélectionner un élève.");
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch("/api/documents/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: selectedStudent,
                    documentType: selectedDoc,
                }),
            });

            if (!res.ok) throw new Error("Échec de la génération");

            const payload = await res.json();
            const link = document.createElement("a");
            link.href = payload.url;
            link.download = payload.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Document généré avec succès.");
        } catch {
            toast.error("Erreur lors de la génération du document.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <PageShell>
                <PageHeader
                    title="Générateur de documents"
                    description="Exportez certificats de scolarité et attestations en PDF sécurisé."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Administration" },
                        { label: "Documents" },
                    ]}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card padding={24}>
                        <div className="mb-6 flex items-center gap-2">
                            <Icon name="cards" size={18} color="var(--brand-600)" />
                            <div>
                                <h2 className="text-base font-semibold" style={{ color: "var(--eduflow-text-primary)" }}>
                                    Paramètres d&apos;impression
                                </h2>
                                <p className="text-sm" style={{ color: "var(--eduflow-text-secondary)" }}>
                                    Sélectionnez le type de document et l&apos;élève concerné.
                                </p>
                            </div>
                        </div>

                        {isLoading ? <PageLoading label="Chargement des élèves…" /> : null}

                        {!isLoading && students.length === 0 ? (
                            <PageEmpty
                                icon="users"
                                title="Aucun élève disponible"
                                description="Inscrivez ou importez des élèves avant de générer un document officiel."
                                actions={[
                                    { label: "Inscrire un élève", href: "/dashboard/students/new" },
                                    { label: t("common.import"), href: "/dashboard/import" },
                                ]}
                            />
                        ) : null}

                        {!isLoading && students.length > 0 ? (
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                        Type de document
                                    </label>
                                    <Select value={selectedDoc} onValueChange={setSelectedDoc}>
                                        <SelectTrigger aria-label="Sélectionner le type de document" className="edu-field h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CERTIFICATE_ENROLLMENT">Certificat de scolarité</SelectItem>
                                            <SelectItem value="BEHAVIOR_REPORT">Attestation de bonne conduite</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--eduflow-text-tertiary)" }}>
                                        Élève
                                    </label>
                                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                                        <SelectTrigger aria-label="Sélectionner un élève" className="edu-field h-10">
                                            <SelectValue placeholder="Choisir un élève" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {students.map((student) => (
                                                <SelectItem key={student.id} value={student.id}>
                                                    {student.user.firstName} {student.user.lastName} ({student.matricule})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row" style={{ borderColor: "var(--eduflow-border-subtle)" }}>
                                    <Button
                                        variant="primary"
                                        className="flex-1"
                                        icon="download"
                                        loading={generating}
                                        onClick={() => void handleGenerate()}
                                    >
                                        Générer et télécharger
                                    </Button>
                                    <Link href="/dashboard/grades" className="flex-1">
                                        <Button variant="secondary" className="w-full" icon="cards">
                                            Voir les bulletins
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ) : null}
                    </Card>

                    <Card padding={24} variant="flat">
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div
                                className="mb-6 grid h-20 w-20 place-items-center rounded-soft"
                                style={{ background: "var(--eduflow-surface-card)", boxShadow: "var(--eduflow-shadow-sm)" }}
                            >
                                <Icon name="cards" size={32} color="var(--brand-600)" />
                            </div>
                            <Badge variant="success" dot>
                                Format conforme
                            </Badge>
                            <h3 className="mt-4 text-xl font-semibold" style={{ color: "var(--eduflow-text-primary)" }}>
                                Documents authentifiés
                            </h3>
                            <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--eduflow-text-secondary)" }}>
                                Chaque PDF inclut le filigrane de l&apos;école, l&apos;en-tête officiel et une signature validée par la direction.
                            </p>
                            <div className="mt-8 w-full space-y-3">
                                <Link href="/dashboard/grades">
                                    <Button variant="secondary" className="w-full justify-start" icon="pencil">
                                        Générer les bulletins de notes
                                    </Button>
                                </Link>
                                <Link href="/dashboard/students">
                                    <Button variant="ghost" className="w-full justify-start" icon="users">
                                        Consulter les dossiers élèves
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </Card>
                </div>
            </PageShell>
        </PageGuard>
    );
}
