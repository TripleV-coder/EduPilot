"use client";

import * as React from "react";

export const OTP_LENGTH = 6;

export interface OtpInputProps {
    /** Chiffres courants, contrôlés par le parent (longueur = OTP_LENGTH). */
    value: string[];
    onChange: (next: string[]) => void;
    /** Appelé dès que les 6 chiffres sont saisis (frappe ou collage). */
    onComplete?: (code: string) => void;
    disabled?: boolean;
    /** Étiquette du groupe pour les lecteurs d'écran. */
    label?: string;
    /** Identifiant d'un message d'erreur à rattacher aux champs. */
    errorId?: string;
}

/**
 * Saisie d'un code à usage unique à 6 chiffres.
 *
 * Extrait de la page de configuration MFA pour être partagé avec l'écran de
 * vérification à la connexion : les deux écrans avaient sinon la même logique
 * de focus, de collage et de navigation clavier dupliquée.
 *
 * Comportement clavier : avance au chiffre suivant à la frappe, recule sur
 * Backspace quand la case est vide, flèches gauche/droite pour naviguer, et
 * collage d'un code complet sur la première case.
 */
export function OtpInput({
    value,
    onChange,
    onComplete,
    disabled = false,
    label = "Code à 6 chiffres",
    errorId,
}: OtpInputProps) {
    const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);

    const focusInput = (index: number) => {
        if (index >= 0 && index < OTP_LENGTH) {
            inputsRef.current[index]?.focus();
        }
    };

    const emit = (next: string[]) => {
        onChange(next);
        const joined = next.join("");
        if (joined.length === OTP_LENGTH && !next.includes("")) {
            onComplete?.(joined);
        }
    };

    const handleDigitChange = (index: number, raw: string) => {
        const digit = raw.replace(/\D/g, "").slice(-1);
        const next = [...value];
        next[index] = digit;
        emit(next);
        if (digit && index < OTP_LENGTH - 1) {
            focusInput(index + 1);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (!value[index] && index > 0) {
                e.preventDefault();
                focusInput(index - 1);
                const next = [...value];
                next[index - 1] = "";
                onChange(next);
            }
        } else if (e.key === "ArrowLeft") {
            focusInput(index - 1);
        } else if (e.key === "ArrowRight") {
            focusInput(index + 1);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, OTP_LENGTH);
        if (!pasted) return;
        const next = Array<string>(OTP_LENGTH).fill("");
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
        emit(next);
        focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
    };

    return (
        <div
            style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 4,
            }}
            role="group"
            aria-label={label}
        >
            {value.map((digit, i) => (
                <input
                    key={i}
                    ref={(el) => {
                        inputsRef.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    disabled={disabled}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    aria-label={`Chiffre ${i + 1}`}
                    aria-describedby={errorId}
                    style={{
                        width: 48,
                        height: 56,
                        textAlign: "center",
                        fontSize: 22,
                        fontWeight: 700,
                        fontFamily: "var(--eduflow-font-mono)",
                        color: "var(--eduflow-text-primary)",
                        background: "var(--eduflow-surface-card)",
                        border: `2px solid ${
                            digit ? "var(--brand-600)" : "var(--eduflow-border-default)"
                        }`,
                        borderRadius: 12,
                        outline: "none",
                        transition:
                            "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        boxShadow: digit ? "0 0 0 3px var(--brand-100)" : "none",
                    }}
                />
            ))}
        </div>
    );
}
