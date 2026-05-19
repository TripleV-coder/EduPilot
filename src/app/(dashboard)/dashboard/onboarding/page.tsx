"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Logo,
    Spinner,
    type IconName,
} from "@/components/edu";
import { SubLabel } from "@/components/edu-homes/_shared";

type Color = "brand" | "success" | "warning" | "danger" | "info";

type Step = { label: string };

type ShellProps = {
    role: string;
    color: Color;
    user: string;
    heroTitle: string;
    heroSub: string;
    steps: string[];
    currentStep: number;
    onSkip?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    nextLabel?: string;
    children: React.ReactNode;
};

function RoleOnboardShell({
    role,
    color,
    user,
    heroTitle,
    heroSub,
    steps,
    currentStep,
    onSkip,
    onPrev,
    onNext,
    nextLabel = "Étape suivante",
    children,
}: ShellProps) {
    const firstName = user.split(" ")[0] || user;
    return (
        <div
            className="eduflow-scope"
            style={{
                display: "grid",
                gridTemplateColumns: "380px 1fr",
                background: "var(--eduflow-surface-page, #f6f7fb)",
                minHeight: "calc(100vh - 32px)",
                borderRadius: "var(--eduflow-radius-card)",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
            }}
        >
            <aside
                style={{
                    padding: "40px 32px",
                    background: `linear-gradient(170deg, var(--eduflow-${color}-700), var(--eduflow-${color}-900, var(--eduflow-${color}-800)))`,
                    color: "#fff",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 36,
                    }}
                >
                    <Logo size={28} />
                    <span
                        className="eduflow-display"
                        style={{ fontSize: 16, fontWeight: 700 }}
                    >
                        EduPilot
                    </span>
                    <span
                        style={{
                            marginLeft: "auto",
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.18)",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                        }}
                    >
                        {role}
                    </span>
                </div>
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        opacity: 0.75,
                        marginBottom: 14,
                    }}
                >
                    Bienvenue
                </div>
                <h1
                    className="eduflow-display"
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        letterSpacing: "-0.025em",
                        margin: "0 0 16px",
                    }}
                >
                    {heroTitle}
                </h1>
                <p
                    style={{
                        fontSize: 14,
                        opacity: 0.88,
                        lineHeight: 1.6,
                        margin: "0 0 30px",
                    }}
                >
                    {heroSub}
                </p>

                <div style={{ marginTop: "auto" }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            opacity: 0.7,
                            marginBottom: 12,
                        }}
                    >
                        Ta checklist · {currentStep}/{steps.length}
                    </div>
                    {steps.map((label, i) => {
                        const done = i < currentStep - 1;
                        const current = i === currentStep - 1;
                        return (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    padding: "8px 0",
                                    alignItems: "center",
                                    opacity: done ? 0.55 : 1,
                                }}
                            >
                                <div
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 11,
                                        background: done
                                            ? "rgba(255,255,255,0.85)"
                                            : current
                                            ? "#fff"
                                            : "rgba(255,255,255,0.18)",
                                        color:
                                            done || current
                                                ? `var(--eduflow-${color}-700)`
                                                : "#fff",
                                        display: "grid",
                                        placeItems: "center",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    {done ? (
                                        <Icon name="check" size={12} strokeWidth={3} />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: current ? 700 : 500,
                                        textDecoration: done ? "line-through" : "none",
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </aside>

            <main style={{ display: "flex", flexDirection: "column", background: "var(--eduflow-surface-card)" }}>
                <header
                    style={{
                        padding: "20px 36px",
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <Avatar name={user} size="sm" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                            Bonjour {firstName} 👋
                        </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onSkip}>
                        Passer la visite
                    </Button>
                </header>
                <div
                    style={{
                        flex: 1,
                        padding: "32px 40px",
                        overflowY: "auto",
                    }}
                >
                    {children}
                </div>
                <footer
                    style={{
                        padding: "16px 36px",
                        borderTop: "1px solid var(--eduflow-border-subtle)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "var(--eduflow-surface-card)",
                    }}
                >
                    <Button
                        variant="ghost"
                        onClick={onPrev}
                        disabled={currentStep <= 1}
                    >
                        ← Revenir
                    </Button>
                    <Button
                        iconRight="chevron"
                        onClick={onNext}
                        style={{
                            background: "var(--gradient-cta, var(--brand-700))",
                        }}
                    >
                        {nextLabel}
                    </Button>
                </footer>
            </main>
        </div>
    );
}

// ─── Top-level page ──────────────────────────────────────────
export default function OnboardingPage() {
    const { data: session, status } = useSession();
    if (status === "loading") {
        return (
            <div className="flex flex-col items-center gap-3 py-24">
                <Spinner size={28} color="var(--brand-600)" />
                <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                    Préparation de ta visite…
                </span>
            </div>
        );
    }
    if (!session?.user) {
        return (
            <div style={{ padding: 48, textAlign: "center" }}>
                <p style={{ fontSize: 14 }}>Session expirée. Reconnecte-toi pour continuer.</p>
            </div>
        );
    }
    const role = session.user.role;
    const user = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() || "EduPilot user";

    if (role === "TEACHER") return <TeacherOnboarding user={user} />;
    if (role === "PARENT") return <ParentOnboarding user={user} />;
    if (role === "STUDENT") return <StudentOnboarding user={user} />;
    if (role === "SUPER_ADMIN") return <SuperAdminOnboarding user={user} />;
    // Director / school admin / accountant / staff fall back to the director
    // wizard handled elsewhere (settings/academic-config + import wizard).
    return <FallbackOnboarding role={role} user={user} />;
}

// ─── 1 · TEACHER ─────────────────────────────────────────────
function TeacherOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(2);
    const steps = [
        "Compléter ton profil",
        "Saisir ta première note",
        "Faire un appel test",
        "Configurer tes alertes",
        "Découvrir l'IA pédagogique",
    ];
    return (
        <RoleOnboardShell
            role="ENSEIGNANT"
            color="brand"
            user={user}
            heroTitle="Pour ta première saisie, commence simple."
            heroSub="On t'a affecté à tes classes. Saisis ta première note en 30 secondes — promis."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Saisis ta première note
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Choisis une classe et un devoir test — on s'occupe du reste.
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 18,
                }}
                className="ob-grid"
            >
                <Card
                    style={{
                        border: "2px solid var(--brand-600)",
                        background: "var(--brand-50)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 10,
                        }}
                    >
                        <SubLabel>Sélection</SubLabel>
                        <Badge variant="brand" size="sm" icon="check">
                            Choisi
                        </Badge>
                    </div>
                    <div
                        className="eduflow-display"
                        style={{ fontSize: 22, fontWeight: 700 }}
                    >
                        Première saisie test
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--brand-800)",
                            margin: "4px 0 0",
                        }}
                    >
                        On t'ouvre la grille de saisie de ta classe principale.
                    </p>
                </Card>
                <Card
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                    }}
                >
                    <SubLabel>Astuces gain de temps</SubLabel>
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            marginTop: 6,
                            lineHeight: 1.5,
                        }}
                    >
                        <div>
                            ⇥ <strong>Tab</strong> passe à l'élève suivant
                        </div>
                        <div>
                            🎙 <strong>Vocal</strong> dicte la note (icône micro)
                        </div>
                        <div>
                            🤖 <strong>IA</strong> suggère une note d'après l'historique
                        </div>
                    </div>
                </Card>
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 10,
                    padding: 14,
                    background: "var(--brand-50)",
                    borderRadius: "var(--eduflow-radius-input)",
                    marginBottom: 22,
                }}
            >
                <Icon
                    name="sparkle"
                    size={16}
                    color="var(--brand-700)"
                    style={{ marginTop: 2 }}
                />
                <div
                    style={{
                        fontSize: 12,
                        color: "var(--brand-900, var(--brand-800))",
                        lineHeight: 1.55,
                    }}
                >
                    <strong>Bonus :</strong> dès que tu valides, EduPilot calcule
                    automatiquement la moyenne classe, génère des alertes pour les élèves
                    &lt; 10 et propose un soutien IA si besoin.
                </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/dashboard/grades/entry" style={{ textDecoration: "none" }}>
                    <Button icon="pencil">Ouvrir la grille de saisie</Button>
                </Link>
                <Link href="/dashboard/attendance" style={{ textDecoration: "none" }}>
                    <Button variant="secondary" icon="check">
                        Faire un appel test
                    </Button>
                </Link>
            </div>
        </RoleOnboardShell>
    );
}

// ─── 2 · PARENT ──────────────────────────────────────────────
function ParentOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(1);
    const steps = [
        "Lier mon premier enfant",
        "Activer les SMS de secours",
        "Configurer le paiement Mobile Money",
        "Choisir mes préférences alertes",
        "Inviter le co-parent",
    ];
    const [matricule, setMatricule] = useState("");
    const [code, setCode] = useState("");
    const [linking, setLinking] = useState(false);
    const [linked, setLinked] = useState<{
        firstName: string;
        lastName: string;
        className: string | null;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLink = async () => {
        if (!matricule.trim()) {
            setError("Saisis le matricule de ton enfant.");
            return;
        }
        setLinking(true);
        setError(null);
        try {
            const res = await fetch("/api/parents/link-child", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    matricule: matricule.trim(),
                    verificationCode: code.trim() || undefined,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || "Erreur");
            setLinked(body.student);
            setStep(2);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLinking(false);
        }
    };

    return (
        <RoleOnboardShell
            role="PARENT"
            color="success"
            user={user}
            heroTitle="Suis ton enfant sans rien manquer."
            heroSub="Lie son compte avec le matricule fourni par l'école. Reçois notes, absences, paiements en temps réel — par SMS aussi si pas de wifi."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Lie ton premier enfant
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                L'école t'a remis un matricule + un code de vérification (carnet de liaison
                ou SMS de bienvenue).
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 18,
                }}
                className="ob-grid"
            >
                <Card>
                    <SubLabel>Informations de liaison</SubLabel>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            marginTop: 10,
                        }}
                    >
                        <LabelledInput
                            label="Matricule élève"
                            icon="users"
                            value={matricule}
                            onChange={setMatricule}
                            placeholder="BJ-2026-A0142"
                        />
                        <LabelledInput
                            label="Code de vérification (6 chiffres)"
                            icon="settings"
                            value={code}
                            onChange={setCode}
                            placeholder="724 891"
                        />
                    </div>
                    {error ? (
                        <div
                            style={{
                                marginTop: 12,
                                padding: 12,
                                background: "var(--eduflow-danger-50)",
                                border: "1px solid var(--eduflow-danger-200)",
                                borderRadius: 10,
                                fontSize: 12,
                                color: "var(--eduflow-danger-800)",
                            }}
                        >
                            {error}
                        </div>
                    ) : null}
                    {linked ? (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 12,
                                background: "var(--eduflow-success-50)",
                                border: "1px solid var(--eduflow-success-200)",
                                borderRadius: 10,
                                display: "flex",
                                gap: 10,
                                alignItems: "flex-start",
                            }}
                        >
                            <Icon
                                name="check"
                                size={16}
                                color="var(--eduflow-success-700)"
                                style={{ marginTop: 2 }}
                            />
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-success-800)",
                                    lineHeight: 1.55,
                                }}
                            >
                                <strong>Lien confirmé</strong> · tu es bien le parent de{" "}
                                <strong>
                                    {linked.firstName} {linked.lastName}
                                </strong>
                                {linked.className ? ` (${linked.className})` : ""}.
                            </div>
                        </div>
                    ) : (
                        <Button
                            icon={linking ? undefined : "check"}
                            loading={linking}
                            onClick={handleLink}
                            disabled={!matricule.trim() || linking}
                            style={{ marginTop: 14 }}
                        >
                            Lier cet enfant
                        </Button>
                    )}
                </Card>

                <Card
                    style={{
                        background:
                            "linear-gradient(135deg, var(--eduflow-success-50), var(--brand-50))",
                        border: "1px solid var(--eduflow-success-200)",
                    }}
                >
                    {linked ? (
                        <>
                            <div style={{ textAlign: "center" }}>
                                <div
                                    style={{
                                        display: "inline-block",
                                        margin: "0 auto 14px",
                                    }}
                                >
                                    <Avatar
                                        name={`${linked.firstName} ${linked.lastName}`}
                                        size="xl"
                                    />
                                </div>
                            </div>
                            <div
                                className="eduflow-display"
                                style={{
                                    fontSize: 22,
                                    fontWeight: 700,
                                    textAlign: "center",
                                    letterSpacing: "-0.02em",
                                }}
                            >
                                {linked.firstName} {linked.lastName}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    textAlign: "center",
                                    marginTop: 2,
                                }}
                            >
                                {linked.className ?? "Classe à confirmer"}
                            </div>
                        </>
                    ) : (
                        <div
                            style={{
                                fontSize: 13,
                                color: "var(--eduflow-text-secondary)",
                                textAlign: "center",
                                padding: "32px 8px",
                                lineHeight: 1.6,
                            }}
                        >
                            Une fois le matricule validé, le profil de ton enfant
                            apparaîtra ici avec ses moyennes et sa présence.
                        </div>
                    )}
                </Card>
            </div>

            <Card style={{ marginTop: 18 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                    }}
                >
                    <Icon name="sms" size={20} color="var(--eduflow-success-700)" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                            Activer les SMS de secours
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                            }}
                        >
                            Reçois les alertes même hors connexion · 94% de lecture en
                            moins de 5 min
                        </div>
                    </div>
                    <Link
                        href="/dashboard/settings/notifications"
                        style={{ textDecoration: "none" }}
                    >
                        <Button variant="secondary" size="sm">
                            Configurer
                        </Button>
                    </Link>
                </div>
            </Card>
        </RoleOnboardShell>
    );
}

// ─── 3 · STUDENT ─────────────────────────────────────────────
function StudentOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(2);
    const [selected, setSelected] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const steps = [
        "Personnaliser mon profil",
        "Choisir mon premier objectif",
        "Découvrir mes cours",
        "Activer les rappels devoirs",
        "Premier badge surprise",
    ];

    const objectives: {
        id: string;
        icon: IconName;
        label: string;
        sub: string;
        color: Color;
        badge: string;
    }[] = [
        {
            id: "top3",
            icon: "trophy",
            label: "Top 3 de la classe",
            sub: "Vise les trois premières moyennes du trimestre.",
            color: "warning",
            badge: "Or",
        },
        {
            id: "streak30",
            icon: "flame",
            label: "30 jours sans absence",
            sub: "Construis une vraie régularité.",
            color: "danger",
            badge: "Argent",
        },
        {
            id: "books5",
            icon: "book",
            label: "Lire 5 livres",
            sub: "Travail de fond lecture & expression.",
            color: "info",
            badge: "Argent",
        },
        {
            id: "homework100",
            icon: "check",
            label: "100% devoirs rendus",
            sub: "Plus rien ne se perd · zéro oubli.",
            color: "success",
            badge: "Or",
        },
        {
            id: "help3",
            icon: "users",
            label: "Aider 3 camarades",
            sub: "Tutorat math / français hebdomadaire.",
            color: "brand",
            badge: "Bronze",
        },
        {
            id: "frenchPlus1",
            icon: "sparkle",
            label: "+1 point en français",
            sub: "Concentre l'effort sur une matière.",
            color: "brand",
            badge: "Argent",
        },
    ];

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preferences: { objective: selected, objectiveSetAt: new Date().toISOString() },
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Erreur");
            }
            setSaved(true);
            setStep(3);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSaving(false);
        }
    };

    return (
        <RoleOnboardShell
            role="ÉLÈVE"
            color="warning"
            user={user}
            heroTitle={`Salut ${user.split(" ")[0]} 👋 prépare-toi à exploser tes scores.`}
            heroSub="Une appli rien que pour toi : tes notes, tes devoirs, tes badges, ton classement. Choisis un objectif pour le trimestre."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={selected ? handleSave : () => setStep((s) => Math.min(steps.length, s + 1))}
            nextLabel={selected ? (saving ? "Enregistrement…" : "Valider mon objectif") : "Étape suivante"}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Choisis ton premier objectif du trimestre
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Un seul à la fois — on suit ta progression et on te débloque un badge
                quand tu l'atteins.
            </p>

            {error ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: 12,
                        background: "var(--eduflow-danger-50)",
                        border: "1px solid var(--eduflow-danger-200)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "var(--eduflow-danger-800)",
                    }}
                >
                    {error}
                </div>
            ) : null}

            {saved ? (
                <div
                    style={{
                        marginBottom: 14,
                        padding: 12,
                        background: "var(--eduflow-success-50)",
                        border: "1px solid var(--eduflow-success-200)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "var(--eduflow-success-800)",
                    }}
                >
                    Objectif enregistré · on suit ta progression sur le tableau de bord.
                </div>
            ) : null}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 14,
                }}
                className="ob-grid-3"
            >
                {objectives.map((o) => {
                    const active = selected === o.id;
                    return (
                        <button
                            key={o.id}
                            type="button"
                            onClick={() => setSelected(o.id)}
                            style={{
                                padding: 20,
                                borderRadius: 14,
                                textAlign: "left",
                                border: active
                                    ? `2px solid var(--eduflow-${o.color}-600)`
                                    : "1px solid var(--eduflow-border-default)",
                                background: active
                                    ? `var(--eduflow-${o.color}-50)`
                                    : "var(--eduflow-surface-card)",
                                position: "relative",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                            aria-pressed={active}
                        >
                            {active ? (
                                <div style={{ position: "absolute", top: 10, right: 10 }}>
                                    <Badge variant={o.color} size="sm" icon="check">
                                        Choisi
                                    </Badge>
                                </div>
                            ) : null}
                            <div
                                style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 14,
                                    background: `var(--eduflow-${o.color}-100, var(--brand-100))`,
                                    display: "grid",
                                    placeItems: "center",
                                    marginBottom: 14,
                                }}
                            >
                                <Icon
                                    name={o.icon}
                                    size={24}
                                    color={`var(--eduflow-${o.color}-700)`}
                                />
                            </div>
                            <div
                                className="eduflow-display"
                                style={{ fontSize: 16, fontWeight: 700 }}
                            >
                                {o.label}
                            </div>
                            <div
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-secondary)",
                                    marginTop: 4,
                                    lineHeight: 1.5,
                                }}
                            >
                                {o.sub}
                            </div>
                            <div
                                style={{
                                    marginTop: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                }}
                            >
                                <Icon
                                    name="trophy"
                                    size={11}
                                    color={`var(--eduflow-${o.color}-700)`}
                                />
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: `var(--eduflow-${o.color}-800)`,
                                    }}
                                >
                                    Badge {o.badge}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </RoleOnboardShell>
    );
}

// ─── 4 · SUPER ADMIN ────────────────────────────────────────
type SchoolRow = {
    id: string;
    name: string;
    city: string | null;
    studentCount?: number | null;
    status?: string;
};

function SuperAdminOnboarding({ user }: { user: string }) {
    const [step, setStep] = useState(3);
    const steps = [
        "Vérifier le domaine entreprise",
        "Activer SSO Microsoft / Google",
        "Importer mes établissements",
        "Définir les KPIs réseau",
        "Inviter mon équipe centrale",
    ];
    const [schools, setSchools] = useState<SchoolRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/schools");
                if (res.ok) {
                    const d = await res.json();
                    const list: SchoolRow[] = Array.isArray(d)
                        ? d
                        : d.data || d.schools || [];
                    setSchools(list);
                }
            } catch {
                /* keep empty */
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const totalStudents = useMemo(
        () =>
            schools.reduce(
                (sum, s) => sum + (s.studentCount ?? 0),
                0
            ),
        [schools]
    );

    return (
        <RoleOnboardShell
            role="SUPER ADMIN"
            color="danger"
            user={user}
            heroTitle="Prends le contrôle de ton réseau d'établissements."
            heroSub="Configure SSO, importe tes écoles, définis les standards qualité du réseau. Vue consolidée temps réel dès la fin."
            steps={steps}
            currentStep={step}
            onPrev={() => setStep((s) => Math.max(1, s - 1))}
            onNext={() => setStep((s) => Math.min(steps.length, s + 1))}
        >
            <h2
                className="eduflow-display"
                style={{
                    fontSize: 24,
                    margin: "0 0 6px",
                    letterSpacing: "-0.02em",
                }}
            >
                Importer mes établissements
            </h2>
            <p
                style={{
                    fontSize: 14,
                    color: "var(--eduflow-text-secondary)",
                    margin: "0 0 22px",
                }}
            >
                Ajoute-les un à un, ou importe via CSV. Chaque établissement reste
                indépendant côté pédagogie · données consolidées pour toi.
            </p>

            <Card padding={0}>
                <div
                    style={{
                        padding: "14px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {loading
                            ? "Chargement…"
                            : `${schools.length} établissement${schools.length > 1 ? "s" : ""} connecté${schools.length > 1 ? "s" : ""}`}
                    </span>
                    <Link
                        href="/dashboard/root-control/schools"
                        style={{ textDecoration: "none" }}
                    >
                        <Button size="sm" icon="plus">
                            Ajouter
                        </Button>
                    </Link>
                </div>
                {loading ? (
                    <div
                        style={{
                            padding: 24,
                            textAlign: "center",
                            color: "var(--eduflow-text-tertiary)",
                            fontSize: 12,
                        }}
                    >
                        <Spinner size={20} color="var(--brand-600)" />
                    </div>
                ) : schools.length === 0 ? (
                    <div
                        style={{
                            padding: "24px 18px",
                            textAlign: "center",
                            fontSize: 12,
                            color: "var(--eduflow-text-tertiary)",
                            lineHeight: 1.55,
                        }}
                    >
                        Aucun établissement encore connecté. Démarre avec
                        « Ajouter » pour configurer le premier site.
                    </div>
                ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <tbody>
                            {schools.slice(0, 8).map((s, i) => (
                                <tr
                                    key={s.id}
                                    style={{
                                        borderTop:
                                            i > 0
                                                ? "1px solid var(--eduflow-border-subtle)"
                                                : 0,
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: "12px 18px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <Avatar name={s.name} size="sm" />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>
                                                {s.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color:
                                                        "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                {s.city ?? "—"}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "12px 18px" }}>
                                        <Badge variant="success" size="sm">
                                            {s.studentCount
                                                ? `Synchro · ${s.studentCount} élèves`
                                                : "Synchro"}
                                        </Badge>
                                    </td>
                                    <td
                                        style={{
                                            padding: "12px 18px",
                                            textAlign: "right",
                                        }}
                                    >
                                        <Link
                                            href={`/dashboard/root-control/schools`}
                                            style={{ textDecoration: "none" }}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                iconRight="chevron"
                                            >
                                                Détail
                                            </Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    marginTop: 16,
                }}
                className="ob-stats"
            >
                <StatTile label="Total élèves réseau" value={String(totalStudents || "—")} sub="des sites actifs" />
                <StatTile label="Chiffrement" value="256-bit" sub="AES isolation par site" />
                <StatTile label="SLA contractuel" value="99,9%" sub="< 200ms latence garantie" />
            </div>
        </RoleOnboardShell>
    );
}

function StatTile({
    label,
    value,
    sub,
}: {
    label: string;
    value: string;
    sub: string;
}) {
    return (
        <Card padding={14}>
            <div
                style={{
                    fontSize: 10,
                    color: "var(--eduflow-text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}
            >
                {label}
            </div>
            <div
                className="eduflow-display tabular"
                style={{
                    fontSize: 22,
                    fontWeight: 700,
                    marginTop: 4,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: 10,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                {sub}
            </div>
        </Card>
    );
}

// ─── Fallback (Director / Accountant / Staff) ────────────────
function FallbackOnboarding({ role, user }: { role: string; user: string }) {
    return (
        <RoleOnboardShell
            role={role}
            color="brand"
            user={user}
            heroTitle="Bienvenue dans EduPilot."
            heroSub="Ton onboarding détaillé pour ce rôle arrive bientôt. En attendant, voici les écrans clés à parcourir."
            steps={[
                "Découvrir le tableau de bord",
                "Configurer ton année académique",
                "Importer tes élèves",
                "Inviter ton équipe",
                "Mettre en place les paiements",
            ]}
            currentStep={1}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <ShortcutCard
                    href="/dashboard/settings/academic-config"
                    icon="settings"
                    title="Configurer l'année académique"
                    body="Choisis trimestre ou semestre · vacances · dates de bulletin."
                />
                <ShortcutCard
                    href="/dashboard/import"
                    icon="users"
                    title="Importer tes élèves"
                    body="Upload CSV · mapping intelligent · gestion des doublons."
                />
                <ShortcutCard
                    href="/dashboard/teachers"
                    icon="users"
                    title="Inviter ton équipe enseignante"
                    body="Comptes prof · classes assignées · SMS bienvenue automatique."
                />
                <ShortcutCard
                    href="/dashboard/finance/fees"
                    icon="money"
                    title="Définir les frais de scolarité"
                    body="Tarifs par cycle · échéancier · Mobile Money."
                />
            </div>
        </RoleOnboardShell>
    );
}

function ShortcutCard({
    href,
    icon,
    title,
    body,
}: {
    href: string;
    icon: IconName;
    title: string;
    body: string;
}) {
    return (
        <Link href={href} style={{ textDecoration: "none" }}>
            <Card style={{ cursor: "pointer" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                    }}
                >
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "var(--brand-50)",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Icon name={icon} size={20} color="var(--brand-700)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--eduflow-text-secondary)",
                                marginTop: 2,
                            }}
                        >
                            {body}
                        </div>
                    </div>
                    <Icon
                        name="chevron"
                        size={16}
                        color="var(--eduflow-text-tertiary)"
                    />
                </div>
            </Card>
        </Link>
    );
}

function LabelledInput({
    label,
    icon,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    icon?: IconName;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
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
