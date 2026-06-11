"use client";

import { useSession } from "next-auth/react";

import { Spinner } from "@/components/edu";
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
