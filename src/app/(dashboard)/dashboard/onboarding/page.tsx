"use client";

import { useSession } from "next-auth/react";

import { PageShell } from "@/components/layout/page-shell";
import { PageLoading } from "@/components/layout/page-states";
import { TeacherOnboarding } from "@/components/onboarding/teacher-onboarding";
import { ParentOnboarding } from "@/components/onboarding/parent-onboarding";
import { StudentOnboarding } from "@/components/onboarding/student-onboarding";
import { SuperAdminOnboarding } from "@/components/onboarding/super-admin-onboarding";
import { FallbackOnboarding } from "@/components/onboarding/fallback-onboarding";

// Extrait de dashboard/onboarding/page.tsx (1441 lignes) lors de la
// découpe par rôle (P3.1, 2026-06-11). Logique inchangée.

export default function OnboardingPage() {
    const { data: session, status } = useSession();
    if (status === "loading") {
        return (
            <PageShell>
                <PageLoading label="Préparation de ta visite…" />
            </PageShell>
        );
    }
    if (!session?.user) {
        return (
            <PageShell>
                <div style={{ padding: 48, textAlign: "center" }}>
                    <p style={{ fontSize: 14 }}>Session expirée. Reconnecte-toi pour continuer.</p>
                </div>
            </PageShell>
        );
    }
    const role = session.user.role;
    const user = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim() || "EduPilot user";

    if (role === "TEACHER") return <PageShell><TeacherOnboarding user={user} /></PageShell>;
    if (role === "PARENT") return <PageShell><ParentOnboarding user={user} /></PageShell>;
    if (role === "STUDENT") return <PageShell><StudentOnboarding user={user} /></PageShell>;
    if (role === "SUPER_ADMIN") return <PageShell><SuperAdminOnboarding user={user} /></PageShell>;
    // Director / school admin / accountant / staff fall back to the director
    // wizard handled elsewhere (settings/academic-config + import wizard).
    return <PageShell><FallbackOnboarding role={role} user={user} /></PageShell>;
}

// ─── 1 · TEACHER ─────────────────────────────────────────────
