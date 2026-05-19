"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type ClassOption = { id: string; name: string; classLevelId?: string };
type ClassLevelOption = { id: string; name: string; code?: string };
type AcademicYearOption = { id: string; name: string; isCurrent?: boolean };
type FeeOption = {
    id: string;
    name: string;
    amount: number | string;
    classLevelCode: string | null;
};

type StepIndex = 0 | 1 | 2 | 3 | 4;

const STEPS: { label: string; icon: IconName }[] = [
    { label: "Identité élève", icon: "users" },
    { label: "Famille", icon: "users" },
    { label: "Cursus & classe", icon: "school" },
    { label: "Documents", icon: "cards" },
    { label: "Paiement initial", icon: "money" },
];

const PEDA_OPTIONS = [
    { id: "english_plus", label: "Anglais renforcé", sub: "4h / semaine", price: 40000 },
    { id: "lv2_german", label: "Allemand LV2", sub: "2h / semaine", price: 25000 },
    { id: "lv2_spanish", label: "Espagnol LV2", sub: "2h / semaine", price: 25000 },
    { id: "canteen", label: "Cantine", sub: "+ 35 000 FCFA / trim.", price: 35000 },
    { id: "transport", label: "Transport scolaire", sub: "+ 45 000 FCFA / trim.", price: 45000 },
    { id: "tutoring", label: "Soutien scolaire", sub: "Vendredi 16h", price: 15000 },
] as const;

type FormState = {
    // Step 1 — Identité
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    matricule: string;
    dateOfBirth: string;
    gender: "" | "MALE" | "FEMALE";
    birthPlace: string;
    nationality: string;
    address: string;
    // Step 2 — Famille
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string;
    parentRelation: string;
    // Step 3 — Cursus
    previousSchool: string;
    previousLevel: string;
    academicYearId: string;
    classId: string;
    admissionDate: string;
    options: Record<string, boolean>;
    // Step 5 — Paiement
    paymentMethod: "cash" | "mobile" | "bank" | "card";
};

const INITIAL_FORM: FormState = {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    matricule: "",
    dateOfBirth: "",
    gender: "",
    birthPlace: "",
    nationality: "Béninoise",
    address: "",
    parentFirstName: "",
    parentLastName: "",
    parentPhone: "",
    parentRelation: "Père",
    previousSchool: "",
    previousLevel: "",
    academicYearId: "",
    classId: "",
    admissionDate: new Date().toISOString().slice(0, 10),
    options: {},
    paymentMethod: "mobile",
};

const FR_AMOUNT = (n: number): string => n.toLocaleString("fr-FR");

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

function loading_spinner_placeholder(loading: boolean) {
    if (!loading) return null;
    return (
        <div className="flex flex-col items-center gap-3 py-6">
            <Spinner size={28} color="var(--brand-600)" />
            <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                Enregistrement de l'inscription…
            </span>
        </div>
    );
}

function StepIdentity({
    form,
    setForm,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Identité de l'élève
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Informations personnelles · obligatoires pour le dossier MEMP.
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 14,
                }}
                className="form-grid"
            >
                <Field
                    label="Nom *"
                    value={form.lastName}
                    onChange={(v) => set("lastName", v)}
                    placeholder="HOUNSOU"
                />
                <Field
                    label="Prénom *"
                    value={form.firstName}
                    onChange={(v) => set("firstName", v)}
                    placeholder="Aïcha"
                />
                <Field
                    label="Matricule *"
                    icon="tag"
                    value={form.matricule}
                    onChange={(v) => set("matricule", v)}
                    placeholder="BJ-2026-A0142"
                />
                <Field
                    label="Date de naissance"
                    type="date"
                    icon="calendar"
                    value={form.dateOfBirth}
                    onChange={(v) => set("dateOfBirth", v)}
                />
                <FieldSelect
                    label="Genre"
                    value={form.gender}
                    onChange={(v) => set("gender", v as FormState["gender"])}
                    options={[
                        { value: "MALE", label: "Masculin" },
                        { value: "FEMALE", label: "Féminin" },
                    ]}
                    placeholder="Choisir…"
                />
                <Field
                    label="Lieu de naissance"
                    value={form.birthPlace}
                    onChange={(v) => set("birthPlace", v)}
                    placeholder="Cotonou"
                />
                <Field
                    label="Nationalité"
                    value={form.nationality}
                    onChange={(v) => set("nationality", v)}
                />
                <Field
                    label="Téléphone *"
                    value={form.phone}
                    onChange={(v) => set("phone", v)}
                    placeholder="+229 90 00 00 00"
                />
                <Field
                    label="Email *"
                    type="email"
                    value={form.email}
                    onChange={(v) => set("email", v)}
                    placeholder="eleve@ecole.bj"
                />
                <Field
                    label="Adresse"
                    value={form.address}
                    onChange={(v) => set("address", v)}
                    placeholder="Akpakpa, Cotonou"
                />
            </div>
        </>
    );
}

function StepFamille({
    form,
    setForm,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Famille / responsable légal
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Un responsable au moins est obligatoire pour les communications école-famille.
            </p>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 14,
                }}
                className="form-grid"
            >
                <Field
                    label="Nom du responsable"
                    value={form.parentLastName}
                    onChange={(v) => set("parentLastName", v)}
                    placeholder="HOUNSOU"
                />
                <Field
                    label="Prénom du responsable"
                    value={form.parentFirstName}
                    onChange={(v) => set("parentFirstName", v)}
                    placeholder="Patrick"
                />
                <FieldSelect
                    label="Lien de parenté"
                    value={form.parentRelation}
                    onChange={(v) => set("parentRelation", v)}
                    options={[
                        { value: "Père", label: "Père" },
                        { value: "Mère", label: "Mère" },
                        { value: "Tuteur", label: "Tuteur / Tutrice" },
                        { value: "Autre", label: "Autre" },
                    ]}
                    placeholder="Choisir…"
                />
                <Field
                    label="Téléphone responsable"
                    value={form.parentPhone}
                    onChange={(v) => set("parentPhone", v)}
                    placeholder="+229 97 12 34 56"
                />
            </div>
            <Card
                padding={14}
                style={{
                    background: "var(--brand-50)",
                    borderLeft: "3px solid var(--brand-500)",
                }}
            >
                <div className="flex items-start gap-3">
                    <Icon name="info" size={18} color="var(--brand-700)" />
                    <div>
                        <div
                            style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--brand-800)",
                            }}
                        >
                            Comptes parent à activer après création
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 4,
                                lineHeight: 1.55,
                            }}
                        >
                            Tu pourras envoyer un code de liaison au responsable depuis la fiche élève
                            une fois l'inscription finalisée.
                        </div>
                    </div>
                </div>
            </Card>
        </>
    );
}

function StepCursus({
    form,
    setForm,
    classes,
    years,
    tuitionFee,
    optionsTotal,
    yearlyTotal,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
    classes: ClassOption[];
    years: AcademicYearOption[];
    tuitionFee: number | null;
    optionsTotal: number;
    yearlyTotal: number;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    const toggleOption = (id: string) =>
        setForm((f) => ({
            ...f,
            options: { ...f.options, [id]: !f.options[id] },
        }));
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Cursus &amp; affectation
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Sélectionnez la classe d'affectation et le parcours pédagogique.
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    marginBottom: 22,
                }}
                className="form-grid"
            >
                <Field
                    label="École précédente"
                    icon="school"
                    value={form.previousSchool}
                    onChange={(v) => set("previousSchool", v)}
                    placeholder="EPP Akpakpa centre"
                />
                <Field
                    label="Dernier niveau validé"
                    value={form.previousLevel}
                    onChange={(v) => set("previousLevel", v)}
                    placeholder="CM2 (moyenne 13,4)"
                />
                <FieldSelect
                    label="Classe demandée *"
                    value={form.classId}
                    onChange={(v) => set("classId", v)}
                    options={classes.map((c) => ({ value: c.id, label: c.name }))}
                    placeholder="Choisir une classe…"
                />
                <FieldSelect
                    label="Année académique *"
                    value={form.academicYearId}
                    onChange={(v) => set("academicYearId", v)}
                    options={years.map((y) => ({ value: y.id, label: y.name }))}
                    placeholder="Choisir l'année…"
                />
                <Field
                    label="Date d'admission"
                    type="date"
                    icon="calendar"
                    value={form.admissionDate}
                    onChange={(v) => set("admissionDate", v)}
                />
            </div>

            <SubLabel>Options pédagogiques</SubLabel>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    marginTop: 8,
                    marginBottom: 22,
                }}
                className="options-grid"
            >
                {PEDA_OPTIONS.map((opt) => {
                    const active = Boolean(form.options[opt.id]);
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleOption(opt.id)}
                            style={{
                                padding: 14,
                                borderRadius: 12,
                                border: active
                                    ? "1.5px solid var(--brand-600)"
                                    : "1px solid var(--eduflow-border-default)",
                                background: active ? "var(--brand-50)" : "transparent",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                textAlign: "left",
                                fontFamily: "inherit",
                                transition: "all var(--motion-fast, 150ms)",
                            }}
                            aria-pressed={active}
                        >
                            <div
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 5,
                                    flexShrink: 0,
                                    border: active
                                        ? 0
                                        : "1.5px solid var(--eduflow-border-strong)",
                                    background: active ? "var(--brand-600)" : "transparent",
                                    display: "grid",
                                    placeItems: "center",
                                }}
                            >
                                {active ? (
                                    <Icon
                                        name="check"
                                        size={11}
                                        color="#fff"
                                        strokeWidth={3}
                                    />
                                ) : null}
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {opt.sub}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Cost summary */}
            <div
                style={{
                    padding: 16,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 14,
                    marginTop: 12,
                }}
                className="cost-grid"
            >
                <CostTile
                    label={`Scolarité ${form.classId ? classes.find((c) => c.id === form.classId)?.name || "" : ""}`}
                    value={tuitionFee !== null ? FR_AMOUNT(tuitionFee) : "—"}
                />
                <CostTile
                    label="Options"
                    value={optionsTotal > 0 ? `+ ${FR_AMOUNT(optionsTotal)}` : "0"}
                />
                <CostTile
                    label="Frais d'inscription"
                    value="+ 0"
                />
                <CostTile
                    label="Total annuel"
                    value={FR_AMOUNT(yearlyTotal)}
                    strong
                    bordered
                />
            </div>
        </>
    );
}

function StepDocuments() {
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Documents requis
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Liste des pièces justificatives à fournir pour le dossier MEMP.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                    { icon: "cards" as IconName, label: "Acte de naissance", note: "PDF ou scan original" },
                    {
                        icon: "cards" as IconName,
                        label: "Bulletin du dernier niveau validé",
                        note: "T1 + T2 + T3 ou semestre 1 + 2",
                    },
                    {
                        icon: "cards" as IconName,
                        label: "Certificat de scolarité précédent",
                        note: "École d'origine",
                    },
                    {
                        icon: "cards" as IconName,
                        label: "Photo d'identité de l'élève",
                        note: "Récente · format passeport",
                    },
                    {
                        icon: "cards" as IconName,
                        label: "Pièce d'identité du responsable",
                        note: "CNI ou passeport",
                    },
                ].map((d) => (
                    <div
                        key={d.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: 14,
                            border: "1px solid var(--eduflow-border-subtle)",
                            borderRadius: 12,
                            gap: 12,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: "var(--brand-50)",
                                    display: "grid",
                                    placeItems: "center",
                                }}
                            >
                                <Icon name={d.icon} size={18} color="var(--brand-700)" />
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 2,
                                    }}
                                >
                                    {d.note}
                                </div>
                            </div>
                        </div>
                        <Badge variant="neutral" size="sm">
                            À téléverser
                        </Badge>
                    </div>
                ))}
            </div>
            <div
                style={{
                    marginTop: 18,
                    padding: 14,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    borderLeft: "3px solid var(--brand-500)",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                }}
            >
                <Icon name="info" size={18} color="var(--brand-700)" />
                <div
                    style={{
                        fontSize: 12,
                        color: "var(--eduflow-text-secondary)",
                        lineHeight: 1.55,
                    }}
                >
                    Les pièces seront téléversées depuis la fiche élève après finalisation. Tu pourras
                    aussi remettre des copies papier au secrétariat.
                </div>
            </div>
        </>
    );
}

function StepPaiement({
    form,
    setForm,
    tuitionFee,
    optionsTotal,
    yearlyTotal,
}: {
    form: FormState;
    setForm: (fn: (f: FormState) => FormState) => void;
    tuitionFee: number | null;
    optionsTotal: number;
    yearlyTotal: number;
}) {
    const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((f) => ({ ...f, [key]: value }));
    const installments = [
        { label: "1ʳᵉ tranche · à l'inscription", amount: Math.round(yearlyTotal * 0.5) },
        { label: "2ᵉ tranche · Décembre", amount: Math.round(yearlyTotal * 0.3) },
        { label: "Solde · Mars", amount: yearlyTotal - Math.round(yearlyTotal * 0.5) - Math.round(yearlyTotal * 0.3) },
    ];
    const methods: { id: FormState["paymentMethod"]; label: string; sub: string }[] = [
        { id: "mobile", label: "Mobile Money", sub: "MTN / Moov · Flutterwave" },
        { id: "bank", label: "Virement bancaire", sub: "RIB de l'école" },
        { id: "cash", label: "Espèces au secrétariat", sub: "Reçu papier" },
        { id: "card", label: "Carte bancaire", sub: "Visa / Mastercard" },
    ];
    return (
        <>
            <h3 className="eduflow-display" style={{ fontSize: 18, margin: "0 0 6px" }}>
                Paiement initial
            </h3>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Plan de paiement et mode de règlement pour la 1ʳᵉ tranche.
            </p>

            <div
                style={{
                    padding: 16,
                    background: "var(--brand-50)",
                    borderRadius: 12,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 14,
                    marginBottom: 22,
                }}
                className="cost-grid"
            >
                <CostTile
                    label="Scolarité annuelle"
                    value={tuitionFee !== null ? FR_AMOUNT(tuitionFee) : "—"}
                />
                <CostTile label="Options" value={`+ ${FR_AMOUNT(optionsTotal)}`} />
                <CostTile label="Frais d'inscription" value="+ 0" />
                <CostTile label="Total annuel" value={FR_AMOUNT(yearlyTotal)} strong bordered />
            </div>

            <SubLabel>Échéancier</SubLabel>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginTop: 8,
                    marginBottom: 22,
                }}
                className="cost-grid"
            >
                {installments.map((i) => (
                    <div
                        key={i.label}
                        style={{
                            padding: 14,
                            border: "1px solid var(--eduflow-border-subtle)",
                            borderRadius: 12,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--eduflow-text-tertiary)",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            {i.label}
                        </div>
                        <div
                            className="eduflow-display tabular"
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: "var(--eduflow-text-primary)",
                                marginTop: 4,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {FR_AMOUNT(i.amount)}
                            <span
                                style={{
                                    fontSize: 10,
                                    color: "var(--eduflow-text-tertiary)",
                                    marginLeft: 4,
                                }}
                            >
                                FCFA
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <SubLabel>Mode de paiement</SubLabel>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 10,
                    marginTop: 8,
                }}
                className="form-grid"
            >
                {methods.map((m) => {
                    const active = form.paymentMethod === m.id;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => set("paymentMethod", m.id)}
                            style={{
                                padding: 14,
                                borderRadius: 12,
                                border: active
                                    ? "1.5px solid var(--brand-600)"
                                    : "1px solid var(--eduflow-border-default)",
                                background: active ? "var(--brand-50)" : "transparent",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                textAlign: "left",
                                fontFamily: "inherit",
                            }}
                            aria-pressed={active}
                        >
                            <div
                                style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    border: active
                                        ? "6px solid var(--brand-600)"
                                        : "1.5px solid var(--eduflow-border-strong)",
                                    background: active ? "#fff" : "transparent",
                                    boxSizing: "border-box",
                                }}
                            />
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {m.sub}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </>
    );
}

function CostTile({
    label,
    value,
    strong,
    bordered,
}: {
    label: string;
    value: string;
    strong?: boolean;
    bordered?: boolean;
}) {
    return (
        <div
            style={{
                borderLeft: bordered ? "1px solid var(--brand-300)" : 0,
                paddingLeft: bordered ? 14 : 0,
            }}
        >
            <div
                style={{
                    fontSize: 10,
                    color: "var(--brand-700)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: strong ? 22 : 18,
                    fontWeight: 700,
                    color: "var(--brand-900)",
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
                <span
                    style={{
                        fontSize: 10,
                        color: "var(--brand-700)",
                        marginLeft: 4,
                    }}
                >
                    FCFA
                </span>
            </div>
        </div>
    );
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    icon,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    icon?: IconName;
    type?: string;
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
            <div style={{ position: "relative" }}>
                {icon ? (
                    <span
                        style={{
                            position: "absolute",
                            left: 12,
                            top: "50%",
                            transform: "translateY(-50%)",
                            display: "inline-flex",
                            pointerEvents: "none",
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        <Icon name={icon} size={14} />
                    </span>
                ) : null}
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    style={{
                        width: "100%",
                        height: 38,
                        padding: icon ? "0 12px 0 34px" : "0 12px",
                        borderRadius: "var(--eduflow-radius-input)",
                        border: "1px solid var(--eduflow-border-default)",
                        background: "var(--eduflow-surface-card)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--eduflow-text-primary)",
                        outline: "none",
                    }}
                />
            </div>
        </label>
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
