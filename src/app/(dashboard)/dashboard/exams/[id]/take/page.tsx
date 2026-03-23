"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
    Clock, 
    AlertCircle, 
    ChevronLeft, 
    ChevronRight, 
    Send,
    Loader2,
    CheckCircle2,
    Trophy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Question = {
    id: string;
    question: string;
    points: number;
    type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
    options: string[];
};

type ExamData = {
    id: string;
    title: string;
    duration: number;
    totalPoints: number;
    questions: Question[];
};

export default function TakeExamPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = params.id as string;

    const { data: exam, error, isLoading } = useSWR<ExamData>(`/api/exams/${id}`, fetcher);

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [result, setIsResult] = useState<any>(null);

    // Initialize timer
    useEffect(() => {
        if (exam && timeLeft === null) {
            setTimeLeft(exam.duration * 60);
        }
    }, [exam, timeLeft]);

    // Timer logic
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0 || isFinished) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    autoSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, isFinished]);

    const autoSubmit = useCallback(() => {
        if (!isFinished) {
            toast({ title: "Temps écoulé !", description: "Votre examen est soumis automatiquement." });
            handleSubmit();
        }
    }, [isFinished, answers]);

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/exams/${id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers }),
            });

            if (!res.ok) throw new Error("Erreur lors de la soumission");

            const data = await res.json();
            setIsResult(data);
            setIsFinished(true);
            toast({ title: "Examen terminé", description: "Vos réponses ont été enregistrées." });
        } catch (err) {
            toast({ title: "Erreur", description: "Impossible de soumettre l'examen.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (isLoading) return <div className="flex justify-center items-center py-24"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (error || !exam) return <div className="text-center py-24"><AlertCircle className="mx-auto h-12 w-12 text-destructive/50" /><h3 className="text-xl font-bold">Examen non trouvé</h3></div>;

    if (isFinished) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4">
                <Card className="border-border shadow-xl overflow-hidden">
                    <div className="bg-primary/10 p-8 text-center border-b border-primary/10">
                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trophy className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-2xl font-display font-bold">Examen Terminé !</h2>
                        <p className="text-muted-foreground mt-1">{exam.title}</p>
                    </div>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-muted/50 text-center">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Votre Score</p>
                                <p className="text-3xl font-bold mt-1 text-primary">{result?.score} / {exam.totalPoints}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-muted/50 text-center">
                                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Résultat</p>
                                <p className={`text-xl font-bold mt-2 ${result?.isPassed ? "text-emerald-500" : "text-destructive"}`}>
                                    {result?.isPassed ? "ADMIS" : "ÉCHEC"}
                                </p>
                            </div>
                        </div>
                        <p className="text-center text-sm text-muted-foreground">
                            Vos réponses ont été enregistrées et seront examinées par votre enseignant.
                        </p>
                    </CardContent>
                    <CardFooter className="bg-muted/30 p-6 flex justify-center">
                        <Link href="/dashboard/exams">
                            <Button className="font-bold">Retour aux examens</Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    const currentQuestion = exam.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / exam.questions.length) * 100;

    return (
        <PageGuard roles={["STUDENT"]}>
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                {/* Header with Timer */}
                <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b border-border px-2">
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/exams/${id}`}>
                            <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold truncate max-w-[200px] sm:max-w-md">{exam.title}</h1>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Question {currentQuestionIndex + 1} sur {exam.questions.length}</p>
                        </div>
                    </div>
                    
                    <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full font-mono font-bold shadow-sm border",
                        (timeLeft || 0) < 300 ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" : "bg-primary/10 text-primary border-primary/20"
                    )}>
                        <Clock className="h-4 w-4" />
                        {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
                    </div>
                </div>

                <Progress value={progress} className="h-2" />

                {/* Question Card */}
                <Card className="border-border shadow-lg">
                    <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-xl leading-snug">{currentQuestion.question}</CardTitle>
                            <span className="shrink-0 bg-muted px-2 py-1 rounded text-xs font-bold">{currentQuestion.points} pts</span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <RadioGroup 
                            value={answers[currentQuestion.id] || ""} 
                            onValueChange={(val) => setAnswers({...answers, [currentQuestion.id]: val})}
                            className="space-y-3"
                        >
                            {currentQuestion.options.map((option, idx) => (
                                <div key={idx} className={cn(
                                    "flex items-center space-x-3 space-y-0 p-4 rounded-xl border transition-all cursor-pointer hover:bg-muted/50",
                                    answers[currentQuestion.id] === option ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                                )}>
                                    <RadioGroupItem value={option} id={`q-${idx}`} />
                                    <Label htmlFor={`q-${idx}`} className="flex-1 cursor-pointer font-medium text-base">{option}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-border bg-muted/10 p-6">
                        <Button 
                            variant="outline" 
                            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                            disabled={currentQuestionIndex === 0}
                            className="gap-2"
                        >
                            <ChevronLeft className="h-4 w-4" /> Précédent
                        </Button>

                        {currentQuestionIndex === exam.questions.length - 1 ? (
                            <Button 
                                onClick={handleSubmit} 
                                disabled={isSubmitting} 
                                className="gap-2 px-8 font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Soumettre l&apos;examen
                            </Button>
                        ) : (
                            <Button 
                                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                                className="gap-2"
                            >
                                Suivant <ChevronRight className="h-4 w-4" />
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                {/* Question Navigator */}
                <div className="flex flex-wrap gap-2 justify-center">
                    {exam.questions.map((q, idx) => (
                        <button
                            key={q.id}
                            onClick={() => setCurrentQuestionIndex(idx)}
                            className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all border",
                                currentQuestionIndex === idx ? "bg-primary text-primary-foreground border-primary shadow-md scale-110" : 
                                answers[q.id] ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-card text-muted-foreground hover:border-primary/50"
                            )}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            </div>
        </PageGuard>
    );
}
