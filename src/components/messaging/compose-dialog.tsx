"use client";

import * as React from "react";
import { Button, Card, Icon } from "@/components/edu";

export interface ComposeDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    /** Affiche un champ Objet éditable. */
    showSubject?: boolean;
    defaultSubject?: string;
    /** Pré-remplit le corps (ex. journal comptable). */
    defaultContent?: string;
    submitLabel?: string;
    successMessage?: string;
    /** Corps facultatif (ex. note libre — le serveur complète le contenu). */
    contentOptional?: boolean;
    /** Libellé du champ corps (défaut : « Message »). */
    contentLabel?: string;
    /** Encart d'information optionnel (ex. nb de destinataires). */
    recipientsHint?: string;
    /**
     * Effectue l'envoi. Doit lever une Error (message FR) en cas d'échec —
     * le message est affiché tel quel à l'utilisateur.
     */
    onSubmit: (payload: { subject: string; content: string }) => Promise<void>;
}

type Phase = "editing" | "sending" | "done";

/**
 * Dialogue de composition de message réutilisable (diffusion classe, envoi
 * journal…). Gère tous les états : édition, envoi (loading), erreur, succès.
 */
export function ComposeDialog({
    open,
    onClose,
    title,
    subtitle,
    showSubject = true,
    defaultSubject = "",
    defaultContent = "",
    submitLabel = "Envoyer",
    successMessage = "Message envoyé.",
    contentOptional = false,
    contentLabel = "Message",
    recipientsHint,
    onSubmit,
}: ComposeDialogProps) {
    const [subject, setSubject] = React.useState(defaultSubject);
    const [content, setContent] = React.useState(defaultContent);
    const [phase, setPhase] = React.useState<Phase>("editing");
    const [error, setError] = React.useState<string | null>(null);
    const firstFieldRef = React.useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

    // Réinitialise à chaque ouverture
    React.useEffect(() => {
        if (open) {
            setSubject(defaultSubject);
            setContent(defaultContent);
            setPhase("editing");
            setError(null);
            const id = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
            return () => window.clearTimeout(id);
        }
    }, [open, defaultSubject, defaultContent]);

    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && phase !== "sending") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, phase, onClose]);

    if (!open) return null;

    const trimmedContent = content.trim();
    const canSubmit =
        phase === "editing" &&
        (contentOptional || trimmedContent.length > 0) &&
        (!showSubject || subject.trim().length > 0);

    async function handleSubmit() {
        if (!canSubmit) return;
        setPhase("sending");
        setError(null);
        try {
            await onSubmit({ subject: subject.trim(), content: trimmedContent });
            setPhase("done");
            window.setTimeout(onClose, 1200);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Échec de l'envoi. Réessayez.");
            setPhase("editing");
        }
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && phase !== "sending") onClose();
            }}
            className="animate-in fade-in"
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                background: "rgba(15, 23, 42, 0.45)",
                display: "grid",
                placeItems: "center",
                padding: 16,
            }}
        >
            <Card
                padding={0}
                className="animate-in fade-in zoom-in-95 duration-200"
                style={{ width: "100%", maxWidth: 480, overflow: "hidden" }}
            >
                <div
                    style={{
                        padding: "18px 20px",
                        borderBottom: "1px solid var(--eduflow-border-default)",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 12,
                    }}
                >
                    <div>
                        <h2
                            className="eduflow-display"
                            style={{ fontSize: 16, fontWeight: 700, margin: 0 }}
                        >
                            {title}
                        </h2>
                        {subtitle ? (
                            <p
                                style={{
                                    fontSize: 12,
                                    color: "var(--eduflow-text-tertiary)",
                                    margin: "4px 0 0",
                                }}
                            >
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={phase === "sending"}
                        aria-label="Fermer"
                        style={{
                            border: 0,
                            background: "transparent",
                            cursor: phase === "sending" ? "not-allowed" : "pointer",
                            padding: 4,
                            borderRadius: 8,
                            color: "var(--eduflow-text-tertiary)",
                        }}
                    >
                        <Icon name="x" size={18} />
                    </button>
                </div>

                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                    {phase === "done" ? (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "14px 0",
                                color: "var(--eduflow-success-700, #15803d)",
                            }}
                        >
                            <Icon name="check" size={20} />
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{successMessage}</span>
                        </div>
                    ) : (
                        <>
                            {recipientsHint ? (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--brand-800)",
                                        background: "var(--brand-50)",
                                        border: "1px solid var(--brand-200)",
                                        borderRadius: 10,
                                        padding: "8px 12px",
                                    }}
                                >
                                    {recipientsHint}
                                </div>
                            ) : null}

                            {showSubject ? (
                                <label style={{ display: "block" }}>
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                            color: "var(--eduflow-text-tertiary)",
                                        }}
                                    >
                                        Objet
                                    </span>
                                    <input
                                        ref={(el) => {
                                            if (showSubject) firstFieldRef.current = el;
                                        }}
                                        className="edu-field"
                                        value={subject}
                                        maxLength={200}
                                        onChange={(e) => setSubject(e.target.value)}
                                        disabled={phase === "sending"}
                                        placeholder="Objet du message"
                                        style={{ marginTop: 6 }}
                                    />
                                </label>
                            ) : null}

                            <label style={{ display: "block" }}>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {contentLabel}
                                    {contentOptional ? " (optionnel)" : ""}
                                </span>
                                <textarea
                                    ref={(el) => {
                                        if (!showSubject) firstFieldRef.current = el;
                                    }}
                                    className="edu-field"
                                    value={content}
                                    maxLength={5000}
                                    rows={5}
                                    onChange={(e) => setContent(e.target.value)}
                                    disabled={phase === "sending"}
                                    placeholder="Votre message…"
                                    style={{ marginTop: 6 }}
                                />
                                <span
                                    style={{
                                        display: "block",
                                        textAlign: "right",
                                        fontSize: 11,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 4,
                                    }}
                                >
                                    {content.length}/5000
                                </span>
                            </label>

                            {error ? (
                                <div
                                    role="alert"
                                    style={{
                                        fontSize: 13,
                                        color: "var(--eduflow-danger-600, #dc2626)",
                                        background: "rgba(239,68,68,0.08)",
                                        border: "1px solid rgba(239,68,68,0.25)",
                                        borderRadius: 10,
                                        padding: "8px 12px",
                                    }}
                                >
                                    {error}
                                </div>
                            ) : null}

                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    disabled={phase === "sending"}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    size="sm"
                                    icon="sms"
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                    loading={phase === "sending"}
                                >
                                    {submitLabel}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}

