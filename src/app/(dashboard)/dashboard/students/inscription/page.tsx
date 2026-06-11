"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon, Spinner } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";
import {
    type ClassOption,
    type ClassLevelOption,
    type AcademicYearOption,
    type FeeOption,
    type StepIndex,
    type FormState,
    STEPS,
    INITIAL_FORM,
    FR_AMOUNT,
    PEDA_OPTIONS,
} from "@/components/students/inscription/types";
import { loading_spinner_placeholder } from "@/components/students/inscription/fields";
import { StepIdentity } from "@/components/students/inscription/step-identity";
import { StepFamille } from "@/components/students/inscription/step-famille";
import { StepCursus } from "@/components/students/inscription/step-cursus";
import { StepDocuments } from "@/components/students/inscription/step-documents";
import { StepPaiement } from "@/components/students/inscription/step-paiement";

// Extrait de dashboard/students/inscription/page.tsx (1421 lignes) lors
// de la découpe en steps (P3.1, 2026-06-11). Logique inchangée.

export default function InscriptionPage() {
    const router = useRouter();
    const [step, setStep] = useState<StepIndex>(0);
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [levels, setLevels] = useState<ClassLevelOption[]>([]);
    const [years, setYears] = useState<AcademicYearOption[]>([]);
    const [fees, setFees] = useState<FeeOption[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [clsRes, yrsRes, feesRes, lvRes] = await Promise.all([
                    fetch("/api/classes"),
                    fetch("/api/academic-years"),
                    fetch("/api/fees").catch(() => null),
                    fetch("/api/class-levels").catch(() => null),
                ]);
                if (clsRes.ok) {
                    const d = await clsRes.json();
                    setClasses(Array.isArray(d) ? d : d.data || d.classes || []);
                }
                if (yrsRes.ok) {
                    const d = await yrsRes.json();
                    const list: AcademicYearOption[] = Array.isArray(d)
                        ? d
                        : d.data || d.academicYears || [];
                    setYears(list);
                    const current = list.find((y) => y.isCurrent) ?? list[0];
                    if (current) {
                        setForm((f) => ({ ...f, academicYearId: current.id }));
                    }
                }
                if (feesRes && feesRes.ok) {
                    const d = await feesRes.json();
                    setFees(Array.isArray(d) ? d : d.data || d.fees || []);
                }
                if (lvRes && lvRes.ok) {
                    const d = await lvRes.json();
                    setLevels(Array.isArray(d) ? d : d.data || []);
                }
            } catch {
                /* selectors are non-blocking */
            }
        };
        load();
    }, []);

    const selectedClass = useMemo(
        () => classes.find((c) => c.id === form.classId) ?? null,
        [classes, form.classId]
    );
    const selectedLevel = useMemo(() => {
        if (!selectedClass?.classLevelId) return null;
        return levels.find((l) => l.id === selectedClass.classLevelId) ?? null;
    }, [levels, selectedClass]);

    const tuitionFee = useMemo(() => {
        if (!fees.length || !selectedLevel) return null;
        const code = selectedLevel.code ?? "";
        const match = fees.find(
            (f) => f.classLevelCode === code || f.classLevelCode === null
        );
        return match ? Number(match.amount) : null;
    }, [fees, selectedLevel]);

    const optionsTotal = useMemo(
        () =>
            PEDA_OPTIONS.reduce(
                (sum, opt) => sum + (form.options[opt.id] ? opt.price : 0),
                0
            ),
        [form.options]
    );

    const yearlyTotal = (tuitionFee ?? 0) + optionsTotal;

    const goNext = () => setStep((s) => Math.min(4, s + 1) as StepIndex);
    const goPrev = () => setStep((s) => Math.max(0, s - 1) as StepIndex);

    const validateForSubmit = (): string | null => {
        if (!form.firstName.trim() || form.firstName.trim().length < 2)
            return "Le prénom doit contenir au moins 2 caractères.";
        if (!form.lastName.trim() || form.lastName.trim().length < 2)
            return "Le nom doit contenir au moins 2 caractères.";
        if (!form.email.trim()) return "L'email est requis.";
        if (!form.phone.trim()) return "Le téléphone est requis.";
        if (!form.matricule.trim()) return "Le matricule est requis.";
        if (!form.classId) return "Sélectionne une classe d'affectation.";
        if (!form.academicYearId) return "Sélectionne une année académique.";
        return null;
    };

    const handleFinalize = async () => {
        const validation = validateForSubmit();
        if (validation) {
            setError(validation);
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: form.email.trim(),
                    firstName: form.firstName.trim(),
                    lastName: form.lastName.trim(),
                    phone: form.phone.trim(),
                    password: "00000000",
                    matricule: form.matricule.trim(),
                    dateOfBirth: form.dateOfBirth || undefined,
                    gender: form.gender || undefined,
                    birthPlace: form.birthPlace.trim() || undefined,
                    nationality: form.nationality.trim() || "Beninoise",
                    address: form.address.trim() || undefined,
                    classId: form.classId,
                    academicYearId: form.academicYearId,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(
                    data.error || "Erreur lors de la création de l'inscription"
                );
            }
            router.push(`/dashboard/students/${data.id || data.student?.id || ""}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDraft = () => {
        try {
            localStorage.setItem("edupilot.inscription.draft", JSON.stringify(form));
            setDraftSaved(true);
            setTimeout(() => setDraftSaved(false), 2500);
        } catch {
            /* ignore */
        }
    };

    useEffect(() => {
        try {
            const raw = localStorage.getItem("edupilot.inscription.draft");
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<FormState>;
                setForm((f) => ({ ...f, ...parsed }));
            }
        } catch {
            /* ignore */
        }
    }, []);

    return (
        <PageGuard
            permission={Permission.STUDENT_CREATE}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
        >
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/students">
                        <Button variant="secondary" size="sm">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Retour
                            </span>
                        </Button>
                    </Link>
                </div>

                <PageHeader
                    greeting="Nouvelle inscription"
                    sub={`Année ${
                        years.find((y) => y.id === form.academicYearId)?.name ||
                        "à venir"
                    } · pré-inscription en ligne · vérification documents`}
                    breadcrumb={["Élèves", "Inscriptions", "Nouveau dossier"]}
                    actions={
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => router.push("/dashboard/students")}
                            >
                                Annuler
                            </Button>
                            <Button variant="secondary" onClick={handleSaveDraft}>
                                {draftSaved ? "Brouillon enregistré ✓" : "Enregistrer brouillon"}
                            </Button>
                            <Button
                                icon={submitting ? undefined : "check"}
                                loading={submitting}
                                onClick={handleFinalize}
                            >
                                Finaliser
                            </Button>
                        </>
                    }
                />

                {/* Stepper */}
                <Card padding={20} style={{ marginBottom: 14 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 12,
                        }}
                    >
                        {STEPS.map((s, i) => {
                            const done = i < step;
                            const active = i === step;
                            const bg = done
                                ? "var(--eduflow-success-600)"
                                : active
                                ? "var(--brand-700)"
                                : "var(--eduflow-neutral-200)";
                            const fg = done || active
                                ? "#fff"
                                : "var(--eduflow-text-tertiary)";
                            const labelColor = active
                                ? "var(--brand-800)"
                                : done
                                ? "var(--eduflow-success-700)"
                                : "var(--eduflow-text-tertiary)";
                            const lineColor = done
                                ? "var(--eduflow-success-300)"
                                : "var(--eduflow-neutral-200)";
                            return (
                                <div
                                    key={s.label}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        flex: i < STEPS.length - 1 ? 1 : 0,
                                        minWidth: 140,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setStep(i as StepIndex)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            border: 0,
                                            background: "transparent",
                                            cursor: "pointer",
                                            padding: 0,
                                            textAlign: "left",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 15,
                                                background: bg,
                                                color: fg,
                                                display: "grid",
                                                placeItems: "center",
                                                fontSize: 13,
                                                fontWeight: 700,
                                                transition: "background var(--motion-fast, 150ms)",
                                            }}
                                        >
                                            {done ? (
                                                <Icon name="check" size={14} strokeWidth={3} />
                                            ) : (
                                                i + 1
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: active ? 700 : 500,
                                                color: labelColor,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {s.label}
                                        </span>
                                    </button>
                                    {i < STEPS.length - 1 ? (
                                        <div
                                            style={{
                                                flex: 1,
                                                height: 2,
                                                background: lineColor,
                                                margin: "0 12px",
                                                minWidth: 16,
                                            }}
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
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
                                {error}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {/* Step content */}
                <Card padding={28}>
                    {step === 0 ? (
                        <StepIdentity
                            form={form}
                            setForm={setForm}
                        />
                    ) : null}
                    {step === 1 ? (
                        <StepFamille form={form} setForm={setForm} />
                    ) : null}
                    {step === 2 ? (
                        <StepCursus
                            form={form}
                            setForm={setForm}
                            classes={classes}
                            years={years}
                            tuitionFee={tuitionFee}
                            optionsTotal={optionsTotal}
                            yearlyTotal={yearlyTotal}
                        />
                    ) : null}
                    {step === 3 ? <StepDocuments /> : null}
                    {step === 4 ? (
                        <StepPaiement
                            form={form}
                            setForm={setForm}
                            tuitionFee={tuitionFee}
                            optionsTotal={optionsTotal}
                            yearlyTotal={yearlyTotal}
                        />
                    ) : null}

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 28,
                            paddingTop: 18,
                            borderTop: "1px solid var(--eduflow-border-subtle)",
                            gap: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <Button
                            variant="secondary"
                            onClick={goPrev}
                            disabled={step === 0}
                        >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <Icon
                                    name="chevron"
                                    size={14}
                                    style={{ transform: "scaleX(-1)" }}
                                />
                                Précédent
                            </span>
                        </Button>
                        <div
                            style={{
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                            }}
                        >
                            Étape {step + 1} / {STEPS.length}
                        </div>
                        {step < 4 ? (
                            <Button onClick={goNext}>
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                    }}
                                >
                                    Continuer
                                    <Icon name="chevron" size={14} />
                                </span>
                            </Button>
                        ) : (
                            <Button
                                icon={submitting ? undefined : "check"}
                                loading={submitting}
                                onClick={handleFinalize}
                            >
                                Finaliser l'inscription
                            </Button>
                        )}
                    </div>
                </Card>

                {loading_spinner_placeholder(submitting)}
            </div>
        </PageGuard>
    );
}
