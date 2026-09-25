"use client";

import { frenchToday } from "./_shared";
import { Bars, Block, Figures, HomeHeader, HomePage, MODULE, QuickActions, Row, decimal } from "./home-kit";

export interface StudentHomeProps {
    userName: string;
    schoolName: string | null;
    periodName: string | null;
    data: {
        myAverage: number;
        myRank: number | null;
        /** null : aucun appel enregistré. */
        attendanceRate: number | null;
        subjectPerformances: { name: string; average: number }[];
        monthlyTrend: { name: string; value: number }[];
    };
}

/* Accueil élève — même langage que l'accueil direction validé (docs/design/directions/direction-approved.md). */
export function StudentHome({ userName, schoolName, periodName, data }: StudentHomeProps) {
    const firstName = userName.trim().split(/\s+/)[0] || userName;
    const graded = data.subjectPerformances.filter((s) => s.average > 0);
    return (
        <HomePage>
            <HomeHeader
                title={`Bonjour, ${firstName}`}
                sub={`${frenchToday()} · ${periodName ?? "Année en cours"}${schoolName ? ` · ${schoolName}` : ""}`}
            />
            <Block id="student-overview" title="Vue d'ensemble" link={{ href: "/dashboard/grades", label: "Mes notes" }}>
                <Figures
                    items={[
                        { label: "Ma moyenne", value: data.myAverage > 0 ? `${decimal(data.myAverage, 2)}/20` : "—", note: periodName ?? "période en cours", color: MODULE.blue, href: "/dashboard/grades" },
                        { label: "Mon rang", value: data.myRank ? `${data.myRank}ᵉ` : "—", note: "dans ma classe", color: MODULE.purple },
                        { label: "Présence", value: data.attendanceRate === null ? "—" : `${decimal(data.attendanceRate)} %`, note: data.attendanceRate === null ? "aucun appel enregistré" : "depuis la rentrée", color: MODULE.green },
                        { label: "Matières notées", value: String(graded.length), note: `sur ${data.subjectPerformances.length}`, color: MODULE.orange },
                    ]}
                />
            </Block>
            <Block id="student-actions" title="Actions rapides">
                <QuickActions
                    actions={[
                        { href: "/dashboard/grades", label: "Mes notes", icon: "book", color: MODULE.blue },
                        { href: "/dashboard/homework", label: "Devoirs", icon: "cards", color: MODULE.green },
                        { href: "/dashboard/schedule", label: "Emploi du temps", icon: "calendar", color: MODULE.orange },
                        { href: "/dashboard/orientation/me", label: "Mon orientation", icon: "sparkle", color: MODULE.purple },
                        { href: "/dashboard/messages", label: "Messagerie", icon: "sms", color: MODULE.pink },
                        { href: "/dashboard/ai", label: "Assistant IA", icon: "sparkle", color: MODULE.teal },
                    ]}
                />
            </Block>
            <Row variant="split">
                <Block id="student-subjects" title="Mes matières">
                    <Bars
                        empty="Pas encore de notes pour cette période."
                        items={graded.map((s) => ({ label: s.name, value: s.average }))}
                    />
                </Block>
                <Block id="student-trend" title="Mes moyennes par période">
                    <Bars
                        empty="L'évolution apparaîtra après la première période notée."
                        items={data.monthlyTrend.filter((m) => m.value > 0).map((m) => ({ label: m.name, value: m.value }))}
                    />
                </Block>
            </Row>
        </HomePage>
    );
}
