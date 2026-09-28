"use client";

import { useState } from "react";
import { Plus, Trash2, Send, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type EditableQuestion = {
    id: string;
    type: string;
    question: string;
    points: number;
    options?: string[];
    correctAnswer?: string | null;
};

type QuestionType = "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";

const TYPE_LABELS: Record<string, string> = {
    MCQ: "Choix multiple",
    TRUE_FALSE: "Vrai ou faux",
    SHORT_ANSWER: "Réponse courte (corrigée par vous)",
};

const EMPTY_CHOICES = ["", "", "", ""];

/**
 * Questions d'un examen en ligne : liste, ajout, suppression et publication.
 * Le total des points suit les questions (calculé par l'API).
 */
export function ExamQuestionsEditor({
    examId,
    isPublished,
    questions,
    locked,
    onChanged,
}: {
    examId: string;
    isPublished: boolean;
    questions: EditableQuestion[];
    /** Des copies ont été rendues : plus aucune modification des questions. */
    locked: boolean;
    onChanged: () => void | Promise<unknown>;
}) {
    const { toast } = useToast();
    const [type, setType] = useState<QuestionType>("MCQ");
    const [statement, setStatement] = useState("");
    const [points, setPoints] = useState(1);
    const [choices, setChoices] = useState<string[]>(EMPTY_CHOICES);
    const [correct, setCorrect] = useState("");
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const reset = () => {
        setStatement("");
        setPoints(1);
        setChoices(EMPTY_CHOICES);
        setCorrect("");
    };

    const addQuestion = async () => {
        const options = choices.map((c) => c.trim()).filter(Boolean);
        const body =
            type === "MCQ"
                ? { type, question: statement, points, options, correctAnswer: correct }
                : type === "TRUE_FALSE"
                  ? { type, question: statement, points, correctAnswer: correct }
                  : { type, question: statement, points };
        setSaving(true);
        try {
            const res = await fetch(`/api/exams/${examId}/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "La question n'a pas été ajoutée.");
            toast({ title: "Question ajoutée" });
            reset();
            await onChanged();
        } catch (err) {
            toast({ title: "Question refusée", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const removeQuestion = async (questionId: string) => {
        const res = await fetch(`/api/exams/${examId}/questions/${questionId}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            toast({ title: "Suppression refusée", description: data.error, variant: "destructive" });
            return;
        }
        await onChanged();
    };

    const togglePublish = async () => {
        setPublishing(true);
        try {
            const res = await fetch(`/api/exams/${examId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isPublished: !isPublished }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Opération refusée.");
            toast({ title: isPublished ? "Examen retiré" : "Examen publié", description: isPublished ? "Les élèves ne le voient plus." : "Les élèves de la classe peuvent le passer." });
            await onChanged();
        } catch (err) {
            toast({ title: "Publication refusée", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
            setPublishing(false);
        }
    };

    const canSubmit =
        statement.trim().length > 0 &&
        points >= 1 &&
        (type === "SHORT_ANSWER" || correct.trim().length > 0) &&
        (type !== "MCQ" || choices.filter((c) => c.trim()).length >= 2);

    return (
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <CardTitle>Questions ({questions.length})</CardTitle>
                <Button onClick={togglePublish} disabled={publishing || (!isPublished && questions.length === 0)} variant={isPublished ? "outline" : "default"} className="gap-2">
                    {isPublished ? <EyeOff className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {isPublished ? "Retirer la publication" : "Publier l'examen"}
                </Button>
            </CardHeader>
            <CardContent className="space-y-6">
                {questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune question pour l&apos;instant. Ajoutez-en une ci-dessous : l&apos;examen ne peut être publié qu&apos;ensuite.</p>
                ) : (
                    <ol className="space-y-3">
                        {questions.map((q, i) => (
                            <li key={q.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                                <span className="text-sm font-bold text-muted-foreground shrink-0">Q{i + 1}.</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm">{q.question}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {q.points} pt{q.points > 1 ? "s" : ""} · {TYPE_LABELS[q.type] ?? q.type}
                                        {q.correctAnswer ? ` · Réponse : ${q.correctAnswer}` : ""}
                                    </p>
                                    {q.type === "MCQ" && q.options && q.options.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {q.options.map((o) => (
                                                <Badge key={o} variant={o === q.correctAnswer ? "default" : "secondary"}>{o}</Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {!locked && (
                                    <Button variant="ghost" size="icon" aria-label={`Supprimer la question ${i + 1}`} onClick={() => void removeQuestion(q.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ol>
                )}

                {locked ? (
                    <p className="text-sm text-muted-foreground">Des copies ont déjà été rendues : les questions ne peuvent plus être modifiées.</p>
                ) : (
                    <fieldset className="space-y-4 rounded-lg border border-dashed border-border p-4">
                        <legend className="px-1 text-sm font-semibold">Nouvelle question</legend>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="question-type">Type de question</Label>
                                <select
                                    id="question-type"
                                    value={type}
                                    onChange={(e) => {
                                        setType(e.target.value as QuestionType);
                                        setCorrect("");
                                    }}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="MCQ">{TYPE_LABELS.MCQ}</option>
                                    <option value="TRUE_FALSE">{TYPE_LABELS.TRUE_FALSE}</option>
                                    <option value="SHORT_ANSWER">{TYPE_LABELS.SHORT_ANSWER}</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="question-points">Points</Label>
                                <Input id="question-points" type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="question-statement">Énoncé</Label>
                            <Textarea id="question-statement" rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
                        </div>

                        {type === "MCQ" && (
                            <div className="space-y-2">
                                <Label>Choix proposés (cochez la bonne réponse)</Label>
                                {choices.map((choice, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="correct-choice"
                                            aria-label={`Choix ${idx + 1} : bonne réponse`}
                                            checked={correct !== "" && correct === choice.trim()}
                                            disabled={!choice.trim()}
                                            onChange={() => setCorrect(choice.trim())}
                                        />
                                        <Input
                                            aria-label={`Choix ${idx + 1}`}
                                            value={choice}
                                            onChange={(e) => {
                                                const next = [...choices];
                                                if (correct === choice.trim()) setCorrect(e.target.value.trim());
                                                next[idx] = e.target.value;
                                                setChoices(next);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {type === "TRUE_FALSE" && (
                            <div className="space-y-2">
                                <Label>Bonne réponse</Label>
                                <div className="flex gap-4">
                                    {["Vrai", "Faux"].map((v) => (
                                        <label key={v} className="flex items-center gap-2 text-sm">
                                            <input type="radio" name="true-false" checked={correct === v} onChange={() => setCorrect(v)} />
                                            {v}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <Button onClick={() => void addQuestion()} disabled={!canSubmit || saving} className="gap-2">
                                <Plus className="h-4 w-4" /> Ajouter la question
                            </Button>
                        </div>
                    </fieldset>
                )}
            </CardContent>
        </Card>
    );
}
