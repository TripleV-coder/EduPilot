"use client";

import { useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { MessageSquare, Send, Users, AlertCircle, Phone, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

export default function SmsNotificationsPage() {
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [target, setTarget] = useState("parents_all");
    const [recipientPhone, setRecipientPhone] = useState("");
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const charCount = message.length;
    const maxSmsChars = 160;
    const smsCount = Math.ceil((charCount > 0 ? charCount : 1) / maxSmsChars);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        setSuccessMsg(null);
        setError(null);

        try {
            if (target === "custom") {
                // Single SMS mode
                if (!recipientPhone.trim()) {
                    setError("Veuillez saisir un numéro de téléphone.");
                    return;
                }

                const res = await fetch("/api/notifications/sms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "CUSTOM",
                        phoneNumber: recipientPhone.trim(),
                        message,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || `Erreur serveur (${res.status})`);
                }

                setSuccessMsg("SMS envoyé avec succès.");
                setMessage("");
                setRecipientPhone("");
            } else {
                // Bulk SMS mode
                const res = await fetch("/api/notifications/sms?bulk=true", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "CUSTOM",
                        target,
                        message,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw new Error(data?.error || `Erreur serveur (${res.status})`);
                }

                const data = await res.json();
                setSuccessMsg(`Campagne SMS terminée : ${data.sent ?? 0} envoyé(s), ${data.failed ?? 0} échoué(s).`);
                setMessage("");
            }

            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Une erreur est survenue lors de l'envoi.";
            setError(msg);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
            <div className="space-y-6 max-w-4xl mx-auto">
                <PageHeader
                    title="Campagnes SMS"
                    description="Envoyez des notifications groupées par SMS aux parents ou au personnel"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Notifications" },
                        { label: "Envoi SMS" },
                    ]}
                />

                {error && (
                    <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {successMsg && (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0" />
                        <p className="text-sm font-medium">{successMsg}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <Card className="border-border shadow-sm">
                            <CardHeader className="bg-muted/30 border-b border-border">
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-primary" />
                                    {t("common.newMessage")}
                                </CardTitle>
                            </CardHeader>
                            <form onSubmit={handleSend}>
                                <CardContent className="pt-6 space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="target">Destinataires</Label>
                                        <Select value={target} onValueChange={setTarget}>
                                            <SelectTrigger id="target" className="bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="parents_all">Tous les parents d'élèves</SelectItem>
                                                <SelectItem value="parents_debt">Parents avec frais impayés</SelectItem>
                                                <SelectItem value="teachers_all">Tous les enseignants</SelectItem>
                                                <SelectItem value="custom">Numéro manuel</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {target === "custom" && (
                                        <div className="space-y-2">
                                            <Label htmlFor="recipientPhone">Numéro de téléphone</Label>
                                            <Input
                                                id="recipientPhone"
                                                type="tel"
                                                value={recipientPhone}
                                                onChange={(e) => setRecipientPhone(e.target.value)}
                                                
                                                className="bg-background"
                                                required={target === "custom"}
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <Label htmlFor="message">Contenu du message</Label>
                                            <span className={`text-xs ${charCount > maxSmsChars * 3 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                                {charCount} caractères • {smsCount} SMS par contact
                                            </span>
                                        </div>
                                        <Textarea
                                            id="message"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            
                                            className="min-h-[150px] resize-y bg-background"
                                            required
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted" onClick={() => setMessage(prev => prev + "{Prenom_Parent} ")}>+ Prénom Parent</Badge>
                                            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted" onClick={() => setMessage(prev => prev + "{Nom_Enfant} ")}>+ Nom Enfant</Badge>
                                            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted" onClick={() => setMessage(prev => prev + "{Solde_A_Payer} ")}>+ Solde à Payer</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/10 border-t border-border mt-4 py-4 flex justify-between">
                                    <Button type="button" variant="outline">Sauvegarder Brouillon</Button>
                                    <Button type="submit" disabled={isSending || charCount === 0} className="gap-2">
                                        {isSending ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        Envoyer
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="border-border shadow-sm border-dashed bg-muted/20">
                            <CardContent className="pt-6 text-center space-y-4">
                                <div className="p-4 bg-primary/10 rounded-full inline-block">
                                    <Phone className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-foreground">Crédits SMS</h3>
                                    <p className="text-3xl font-bold mt-2">1 450</p>
                                    <p className="text-sm text-muted-foreground mt-1">SMS restants sur votre compte</p>
                                </div>
                                <Button variant="outline" className="w-full mt-2">Recharger</Button>
                            </CardContent>
                        </Card>

                        <Card className="border-border shadow-sm border-l-4 border-l-orange-500">
                            <CardContent className="p-4">
                                <h4 className="font-semibold flex items-center gap-2 mb-2">
                                    <AlertCircle className="w-4 h-4 text-orange-500" />
                                    Bonnes pratiques
                                </h4>
                                <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-4">
                                    <li>Évitez les caractères spéciaux complexes qui peuvent doubler le coût du SMS.</li>
                                    <li>Inscrivez toujours le nom de l'école (ex: "Info EduPilot: ...").</li>
                                    <li>Privilégiez les envois entre 8h00 et 19h00.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </PageGuard>
    );
}
