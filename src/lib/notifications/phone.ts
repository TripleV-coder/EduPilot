/**
 * Numéro de téléphone → format international sans « + » (ex. 2290197000000),
 * tel qu'attendu par WhatsApp et les passerelles vocales.
 *
 * Bénin : depuis la migration de 2024, les numéros comptent 10 chiffres
 * (préfixe « 01 » devant les anciens numéros à 8 chiffres). Un numéro local à
 * 8 chiffres est donc complété par « 01 », puis l'indicatif 229 est ajouté.
 */
export function toInternationalDigits(raw: string | null | undefined, defaultCountry = "229"): string | null {
    if (!raw) return null;
    let digits = raw.trim().replace(/[\s.\-()]/g, "");
    if (digits.startsWith("+")) digits = digits.slice(1);
    else if (digits.startsWith("00")) digits = digits.slice(2);
    if (!/^\d+$/.test(digits)) return null;

    if (defaultCountry === "229") {
        if (digits.length === 8) digits = `22901${digits}`;
        else if (digits.length === 10 && digits.startsWith("01")) digits = `229${digits}`;
        else if (digits.length === 11 && digits.startsWith("229")) digits = `22901${digits.slice(3)}`;
    }
    return digits.length >= 11 && digits.length <= 15 ? digits : null;
}
