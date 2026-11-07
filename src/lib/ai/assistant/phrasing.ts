/**
 * Formulation des réponses : variété des tournures et ton adapté au rôle,
 * sans modèle de langage.
 *
 * - `vary` choisit une tournure parmi plusieurs, de façon stable pour une même
 *   question (graine = texte de la question) : deux questions différentes ne
 *   reçoivent pas forcément la même phrase, mais une réponse ne change pas au rechargement.
 * - `Voice` donne le registre : chaleureux et rassurant pour les familles,
 *   direct et factuel pour la direction et les enseignants.
 * - `joinFr` relie une énumération comme on l'écrirait.
 */
import type { AssistantScope } from "./scope";

/** Empreinte FNV-1a 32 bits : rapide, stable, suffisante pour choisir une tournure. */
export function hashSeed(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

export function vary(seed: number, variants: readonly string[], salt = 0): string {
    if (variants.length === 0) return "";
    const index = ((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0) % variants.length;
    return variants[index];
}

/** « a », « a et b », « a, b et c ». */
export function joinFr(items: readonly string[]): string {
    if (items.length <= 1) return items[0] ?? "";
    return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** Première lettre en capitale. */
export function sentence(text: string): string {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export type Register = "family" | "staff";

export interface Voice {
    register: Register;
    seed: number;
    /** Tournure stable parmi des variantes. */
    pick: (variants: readonly string[], salt?: number) => string;
    /** Variante selon le registre. */
    by: (family: readonly string[], staff: readonly string[], salt?: number) => string;
}

export function voiceFor(scope: Pick<AssistantScope, "kind" | "user">, message: string): Voice {
    const register: Register = scope.kind === "family" ? "family" : "staff";
    const seed = hashSeed(`${message}|${scope.user.id}`);
    const pick = (variants: readonly string[], salt = 0) => vary(seed, variants, salt);
    return {
        register,
        seed,
        pick,
        by: (family, staff, salt = 0) => pick(register === "family" ? family : staff, salt),
    };
}

/**
 * Rend lisible une description technique du modèle de risque :
 * « Taux de présence de 88% (recommandé: >90%) » → « taux de présence de 88 % (au moins 90 % recommandés) ».
 */
export function humanize(description: string): string {
    return description
        .replace(/\(recommandé\s*:\s*>\s*(\d+(?:[.,]\d+)?)%\)/g, "(au moins $1 % recommandés)")
        .replace(/\(seuil critique\s*:\s*(\d+(?:[.,]\d+)?)%\)/g, "(seuil critique : $1 %)")
        .replace(/(\d)%/g, "$1 %")
        .replace(/\s*:\s*/g, " : ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Appréciation d'ensemble d'une moyenne, au ton du registre. */
export function judgeAverage(voice: Voice, average: number, passing: number): string {
    const gap = average - passing;
    if (gap >= 4) {
        return voice.by(
            ["c'est un très beau niveau", "les résultats sont excellents", "c'est un très bon travail"],
            ["niveau très solide", "résultats excellents", "très bon niveau"],
            1,
        );
    }
    if (gap >= 1.5) {
        return voice.by(
            ["c'est un bon niveau", "les résultats sont bons", "le travail paie"],
            ["bon niveau", "résultats satisfaisants", "niveau correct"],
            1,
        );
    }
    if (gap >= 0) {
        return voice.by(
            ["c'est juste au-dessus du seuil : un effort régulier fera la différence", "c'est encourageant, même si la marge reste faible"],
            ["juste au-dessus du seuil, marge faible", "au-dessus du seuil mais fragile"],
            1,
        );
    }
    return voice.by(
        [
            "c'est en dessous du seuil pour l'instant, mais rien n'est figé : un accompagnement ciblé peut vite changer les choses",
            "le seuil n'est pas encore atteint ; avec un suivi régulier, c'est rattrapable",
        ],
        ["sous le seuil de réussite, accompagnement à prévoir", "en dessous du seuil, priorité de suivi"],
        1,
    );
}
