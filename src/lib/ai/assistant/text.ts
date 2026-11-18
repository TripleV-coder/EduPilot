/**
 * Traitement du français pour l'assistant local — sans dépendance.
 *
 * - `normalize` : minuscules, accents retirés, apostrophes et ponctuation en
 *   espaces, ordinaux scolaires unifiés (« 3ème », « 3eme », « 3è » → « 3e » ;
 *   « 1ère » → « 1re » ; « Tle » → « terminale »).
 * - `stem` : racine légère (pluriels, -ment, -tion…) pour que « absences »,
 *   « absent » et « absentéisme » se rejoignent.
 * - `similar` : tolérance aux fautes de frappe (distance de Damerau-Levenshtein
 *   bornée), proportionnée à la longueur du mot.
 */

const STOPWORDS = new Set([
    "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "d", "dans", "de", "des", "du", "elle", "en",
    "et", "est", "il", "ils", "je", "j", "l", "la", "le", "les", "leur", "leurs", "lui", "m", "ma", "me",
    "mes", "moi", "mon", "ne", "nos", "notre", "nous", "on", "ou", "par", "pas", "pour", "qu", "que",
    "qui", "s", "sa", "se", "ses", "son", "sur", "t", "ta", "te", "tes", "toi", "ton", "tu", "un", "une",
    "vos", "votre", "vous", "y", "c", "ca", "cela", "ceci", "svp", "stp", "plait", "merci", "peux",
    "peut", "pouvez", "veux", "voudrais", "aimerais", "donne", "donner", "dis", "dire", "montre",
    "montrer", "affiche", "afficher", "quel", "quelle", "quels", "quelles", "suis", "sont", "ai", "as",
    "avez", "avons", "ont", "etre", "avoir", "faire", "fait", "bien", "tout", "tous", "toutes", "toute",
    "voir", "il", "elle", "est", "sont",
]);

/** Minuscules, accents retirés, ponctuation → espaces, ordinaux unifiés. */
export function normalize(input: string): string {
    let text = input
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[’'`´]/g, " ")
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/-/g, " ");

    // « 1ere », « 1 ere », « 1re », « 1er » → « 1re » (avant la règle générale)
    text = text.replace(/\b1\s*(?:ere|re|er)\b/g, "1re");
    // Ordinaux scolaires : « 3eme », « 3 eme », « 3ieme », « 3em », « 3e » → « 3e »
    text = text.replace(/\b(\d{1,2})\s*(?:ieme|eme|em|e)\b/g, "$1e");
    // « 2nde », « 2nd », « seconde » → « 2nde »
    text = text.replace(/\b(?:2\s*nde|2\s*nd|seconde)\b/g, "2nde");
    // « tle », « term » → « terminale »
    text = text.replace(/\b(?:tle|term)\b/g, "terminale");

    return text.replace(/\s+/g, " ").trim();
}

/** Mots normalisés, dans l'ordre. */
export function words(input: string): string[] {
    const text = normalize(input);
    return text ? text.split(" ") : [];
}

export function isStopword(word: string): boolean {
    return STOPWORDS.has(word);
}

/** Mots porteurs de sens (mots-outils retirés). */
export function contentWords(input: string): string[] {
    return words(input).filter((word) => !STOPWORDS.has(word));
}

const SUFFIXES = [
    "issements", "issement", "ements", "ement", "ations", "ation", "ateurs", "ateur", "atrices",
    "atrice", "ismes", "isme", "istes", "iste", "ances", "ance", "ences", "ence", "ments", "ment",
    "euses", "euse", "eurs", "eur", "ites", "ite", "ives", "ive", "ifs", "if", "aux", "ees", "ee",
    "es", "er", "ez", "s", "e",
];

/** Racine légère d'un mot normalisé (au moins 3 lettres conservées). */
export function stem(word: string): string {
    if (word.length <= 3 || /\d/.test(word)) return word;
    for (const suffix of SUFFIXES) {
        if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
            return word.slice(0, -suffix.length);
        }
    }
    return word;
}

/**
 * Distance de Damerau-Levenshtein (transpositions adjacentes comprises),
 * interrompue dès qu'elle dépasse `max` : coût borné même sur des mots longs.
 */
export function editDistance(a: string, b: string, max = 2): number {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;

    const cols = b.length + 1;
    let prevPrev = new Array<number>(cols).fill(0);
    let prev = Array.from({ length: cols }, (_, j) => j);

    for (let i = 1; i <= a.length; i++) {
        const current = new Array<number>(cols).fill(0);
        current[0] = i;
        let rowMin = current[0];
        for (let j = 1; j < cols; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let value = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                value = Math.min(value, prevPrev[j - 2] + 1);
            }
            current[j] = value;
            if (value < rowMin) rowMin = value;
        }
        if (rowMin > max) return max + 1;
        prevPrev = prev;
        prev = current;
    }
    return prev[cols - 1];
}

/** Fautes tolérées selon la longueur : 0 jusqu'à 3 lettres, 1 jusqu'à 7, 2 au-delà. */
export function allowedTypos(length: number): number {
    if (length <= 3) return 0;
    if (length <= 7) return 1;
    return 2;
}

/** Vrai si deux mots normalisés sont identiques à une faute de frappe près. */
export function similar(a: string, b: string): boolean {
    if (a === b) return true;
    if (/\d/.test(a) || /\d/.test(b)) return false;
    const max = allowedTypos(Math.min(a.length, b.length));
    if (max === 0) return false;
    return editDistance(a, b, max) <= max;
}

/** Forme compacte (sans espaces) pour comparer des libellés comme « 3e B » et « 3eB ». */
export function compact(input: string): string {
    return normalize(input).replace(/\s+/g, "");
}
