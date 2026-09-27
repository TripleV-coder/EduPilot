"use client";

import { formatNumber, frenchToday } from "./_shared";
import {
    Bars, Block, DayTimeline, Figures, HomeHeader, HomePage, MODULE, QuickActions, Row, WatchList, decimal, initials,
} from "./home-kit";

export interface TeacherTodaySlot {
    id: string;
    classId?: string | null;
    classSubjectId?: string | null;
    time: string;
    className: string;
    subjectName: string;
    room: string;
    state: "done" | "now" | "next";
}

export interface TeacherHomeProps {
    userName: string;
    schoolName: string | null;
    periodName: string | null;
    data: {
        myClasses: number;
        myStudents: number;
        classAverage: number;
        classPerformance: { name: string; average: number }[];
        atRiskStudents: { id: string; name: string; className: string; average: number; riskLevel: string }[];
        monthlyTrend: { name: string; value: number }[];
        todaySchedule?: TeacherTodaySlot[];
    };
}

/* Accueil enseignant — même langage que l'accueil direction validé
   (docs/design/directions/live) : vue d'ensemble, journée, actions, suivi. */
export function TeacherHome({ userName, schoolName, periodName, data }: TeacherHomeProps) {
    const firstName = userName.trim().split(/\s+/)[0] || userName;
    const today = data.todaySchedule ?? [];
    return (
        <HomePage>
            <HomeHeader
                title={`Bonjour, ${firstName}`}
                sub={`${frenchToday()} · ${periodName ?? "Année en cours"}${schoolName ? ` · ${schoolName}` : ""}`}
            />
            <Row>
                <Block id="teacher-overview" title="Vue d'ensemble" link={{ href: "/dashboard/grades", label: "Mes notes" }}>
                    <Figures
                        items={[
                            { label: "Mes classes", value: formatNumber(data.myClasses), note: "cette période", color: MODULE.blue },
                            { label: "Mes élèves", value: formatNumber(data.myStudents), note: "toutes classes", color: MODULE.teal, href: "/dashboard/students" },
                            { label: "Moyenne", value: data.classAverage > 0 ? `${decimal(data.classAverage)}/20` : "—", note: "de mes classes", color: MODULE.green },
                            { label: "À suivre", value: formatNumber(data.atRiskStudents.length), note: "élèves en difficulté", color: MODULE.pink },
                        ]}
                    />
                </Block>
                <Block id="teacher-day" title="Ma journée" link={{ href: "/dashboard/schedule", label: "Emploi du temps" }}>
                    <DayTimeline
                        empty="Aucun cours prévu aujourd'hui."
                        more={{
                            href: "/dashboard/schedule",
                            label: (n) => `+ ${n} autre${n > 1 ? "s" : ""} cours aujourd'hui`,
                        }}
                        items={today.map((s) => {
                            const [start, end] = s.time.split(/\s*[—–-]\s*/);
                            return {
                                key: s.id,
                                time: start,
                                title: `${s.subjectName} · ${s.className}`,
                                sub: [end ? `jusqu'à ${end}` : null, roomLabel(s.room)].filter(Boolean).join(" · "),
                                state: s.state,
                                // Le cours en cours ou à venir s'ouvre en un geste sur la bonne classe.
                                actions:
                                    s.state !== "done" && s.classId
                                        ? [
                                              { href: `/dashboard/attendance?classId=${s.classId}`, label: "Appel" },
                                              ...(s.classSubjectId
                                                  ? [{ href: `/dashboard/grades/entry?classId=${s.classId}&classSubjectId=${s.classSubjectId}`, label: "Notes" }]
                                                  : []),
                                          ]
                                        : undefined,
                            };
                        })}
                    />
                </Block>
            </Row>
            <Block id="teacher-actions" title="Actions rapides">
                <QuickActions
                    actions={[
                        { href: "/dashboard/attendance", label: "Faire l'appel", icon: "check", color: MODULE.blue },
                        { href: "/dashboard/grades/entry", label: "Saisir des notes", icon: "book", color: MODULE.green },
                        { href: "/dashboard/grades/cahier", label: "Cahier de textes", icon: "cards", color: MODULE.purple },
                        { href: "/dashboard/students", label: "Mes élèves", icon: "users", color: MODULE.teal },
                        { href: "/dashboard/schedule", label: "Emploi du temps", icon: "calendar", color: MODULE.orange },
                        { href: "/dashboard/messages", label: "Messages", icon: "sms", color: MODULE.pink },
                    ]}
                />
            </Block>
            <Row variant="split">
                <Block id="teacher-watch" title="À surveiller">
                    <WatchList
                        calm="Aucun élève en difficulté détecté dans vos classes."
                        items={data.atRiskStudents.slice(0, 5).map((s) => ({
                            key: s.id,
                            avatar: initials(s.name),
                            color: s.riskLevel.toLowerCase() === "critical" ? MODULE.pink : MODULE.orange,
                            name: s.name,
                            detail: `${s.className} · moyenne ${decimal(s.average, 2)}/20`,
                            action: { href: `/dashboard/students/${s.id}`, label: "Voir le dossier" },
                        }))}
                    />
                </Block>
                <Block id="teacher-classes" title="Moyennes de mes classes">
                    <Bars
                        empty={`Aucune moyenne publiée pour ${periodName ?? "cette période"} pour l'instant.`}
                        items={data.classPerformance.map((c) => ({ label: c.name, value: c.average }))}
                    />
                </Block>
            </Row>
        </HomePage>
    );
}

/** « Salle65 » ou « 65 » → « Salle 65 » ; absente → mention explicite. */
function roomLabel(room: string | null | undefined): string {
    const r = (room ?? "").trim();
    if (!r || r === "—") return "Salle non renseignée";
    return /^salle/i.test(r) ? r.replace(/^salle\s*/i, "Salle ") : `Salle ${r}`;
}
