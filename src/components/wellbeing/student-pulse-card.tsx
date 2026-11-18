"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { fetcher } from "@/lib/fetcher";
import { httpStatusOf } from "@/lib/http-error";
import { Block } from "@/components/edu-homes/home-kit";
import { Button } from "@/components/ui/button";

interface PulseState {
    weekLabel: string;
    answered: boolean;
    questions: {
        score: string;
        safety: string;
        friend: string;
        adultListens: string;
        harassWitness: string;
    };
}

type YesNo = "yes" | "no" | null;
const YES_NO_KEYS = ["safety", "friend", "adultListens", "harassWitness"] as const;
type YesNoKey = (typeof YES_NO_KEYS)[number];

/**
 * Pulse climat de la semaine sur l'accueil élève (GET/POST /api/wellbeing/pulse).
 * Les réponses sont anonymes et seulement agrégées. Module « bien-être »
 * désactivé par l'école (403) : la carte n'apparaît pas.
 */
export function StudentPulseCard() {
    const { data, error, isLoading, mutate } = useSWR<PulseState>("/api/wellbeing/pulse", fetcher, {
        revalidateOnFocus: false,
    });
    const [score, setScore] = useState<number | null>(null);
    const [answers, setAnswers] = useState<Record<YesNoKey, YesNo>>({
        safety: null,
        friend: null,
        adultListens: null,
        harassWitness: null,
    });
    const [busy, setBusy] = useState(false);

    const status = httpStatusOf(error);
    if (status === 403 || status === 404) return null;

    const listenLink = (
        <Link href="/dashboard/wellbeing/new" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
            Parler à la cellule d&apos;écoute
        </Link>
    );

    if (isLoading) {
        return (
            <Block id="student-pulse" title="Ma semaine à l'école">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement du questionnaire…
                </p>
            </Block>
        );
    }

    if (error || !data) {
        return (
            <Block id="student-pulse" title="Ma semaine à l'école">
                <p className="text-sm text-muted-foreground">Le questionnaire de la semaine n&apos;a pas pu être chargé.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void mutate()}>
                    Réessayer
                </Button>
            </Block>
        );
    }

    if (data.answered) {
        return (
            <Block id="student-pulse" title="Ma semaine à l'école">
                <p className="text-sm">
                    Merci ! Ta réponse de la semaine est enregistrée, sans ton nom. Le prochain questionnaire ouvre lundi.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Besoin d&apos;en parler ? {listenLink}</p>
            </Block>
        );
    }

    const complete = score !== null && YES_NO_KEYS.every((k) => answers[k] !== null);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!complete) return;
        setBusy(true);
        try {
            const res = await fetch("/api/wellbeing/pulse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    score,
                    safety: answers.safety === "yes",
                    friend: answers.friend === "yes",
                    adultListens: answers.adultListens === "yes",
                    harassWitness: answers.harassWitness === "yes",
                }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok && res.status !== 409) {
                toast.error(body.error || "Ta réponse n'a pas été enregistrée.");
                return;
            }
            toast.success(res.status === 409 ? (body.error ?? "Déjà répondu cette semaine.") : "Merci pour ta réponse !");
            await mutate();
        } catch {
            toast.error("Connexion impossible : ta réponse n'a pas été enregistrée.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Block id="student-pulse" title="Ma semaine à l'école">
            <form onSubmit={submit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    5 questions, une minute. Anonyme : ton nom n&apos;est jamais associé à tes réponses.
                </p>
                <fieldset>
                    <legend className="mb-2 text-sm font-medium">{data.questions.score}</legend>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={data.questions.score}>
                        {Array.from({ length: 11 }, (_, n) => (
                            <label
                                key={n}
                                className={`grid h-9 w-9 cursor-pointer place-items-center rounded-md border text-sm font-semibold transition-colors ${
                                    score === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="pulse-score"
                                    value={n}
                                    checked={score === n}
                                    onChange={() => setScore(n)}
                                    className="sr-only"
                                />
                                {n}
                            </label>
                        ))}
                    </div>
                </fieldset>
                {YES_NO_KEYS.map((key) => (
                    <fieldset key={key}>
                        <legend className="mb-1.5 text-sm font-medium">{data.questions[key]}</legend>
                        <div className="flex gap-2">
                            {(["yes", "no"] as const).map((value) => (
                                <label
                                    key={value}
                                    className={`cursor-pointer rounded-md border px-4 py-1.5 text-sm transition-colors ${
                                        answers[key] === value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name={`pulse-${key}`}
                                        value={value}
                                        checked={answers[key] === value}
                                        onChange={() => setAnswers((prev) => ({ ...prev, [key]: value }))}
                                        className="sr-only"
                                    />
                                    {value === "yes" ? "Oui" : "Non"}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="submit" disabled={!complete || busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Envoyer
                    </Button>
                    {listenLink}
                </div>
            </form>
        </Block>
    );
}
