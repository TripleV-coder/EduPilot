/**
 * Formules de calcul écrites par l'école ou par l'enseignant d'une matière.
 *
 * Une formule s'écrit comme dans un tableur, par exemple :
 *   moyenne(MI ; DEVOIRS ; COMPOS)            ← règle officielle du Bénin
 *   moyenne(moyenne(MI ; MD) ; MC)            ← moyenne de classe puis composition
 *   (MI + 2*MD + 3*MC) / 6                    ← pondération libre
 *
 * Sécurité et précision :
 *   - la formule est LUE par ce module (analyse puis calcul), jamais exécutée
 *     comme du code ; seuls les nombres, + − × ÷, les parenthèses, les
 *     variables et les cinq fonctions ci-dessous sont acceptés ;
 *   - calcul en fractions exactes (aucune virgule flottante) ;
 *   - avant d'être enregistrée, une formule est essayée sur des cas types :
 *     toutes les notes à 20 doivent donner 20, toutes à 0 donner 0, et aucun
 *     cas ne doit sortir de 0 à 20.
 *
 * Valeur manquante (pas d'interrogation, pas de composition…) : « vide ».
 *   - moyenne(), somme(), nombre(), min(), max() ignorent ce qui est vide ;
 *   - un calcul + − × ÷ avec une valeur vide donne vide (matière « NC »).
 */
import { Rational, mean, sum } from "@/lib/academic/rational";

export type FormulaScope = "SUBJECT" | "ANNUAL";

export class FormulaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FormulaError";
    }
}

// ─────────────────────────── Vocabulaire ───────────────────────────

type VarKind = "number" | "list";

interface VariableInfo {
    kind: VarKind;
    label: string;
}

/** Nombre maximal de notes nommées par famille (I1…I9, D1…D9, C1…C9). */
export const MAX_INDEX = 9;

/** Variables d'une formule de matière. */
export const SUBJECT_VARIABLES: Record<string, VariableInfo> = {
    MI: { kind: "number", label: "moyenne des interrogations" },
    MD: { kind: "number", label: "moyenne des devoirs" },
    MC: { kind: "number", label: "moyenne des compositions" },
    INTERROS: { kind: "list", label: "toutes les interrogations, une par une" },
    DEVOIRS: { kind: "list", label: "tous les devoirs, un par un" },
    COMPOS: { kind: "list", label: "toutes les compositions, une par une" },
    ...indexedVariables(),
};

/** I1…I9, D1…D9, C1…C9 : chaque note de l'élève, par famille et par date. */
function indexedVariables(): Record<string, VariableInfo> {
    const out: Record<string, VariableInfo> = {};
    const families: Array<[string, string]> = [
        ["I", "interrogation"],
        ["D", "devoir"],
        ["C", "composition"],
    ];
    for (const [letter, name] of families) {
        for (let i = 1; i <= MAX_INDEX; i++) {
            out[`${letter}${i}`] = { kind: "number", label: `${i === 1 ? "1ʳᵉ" : `${i}ᵉ`} ${name} de la période` };
        }
    }
    return out;
}

/** Variables d'une formule de moyenne annuelle (P1 = 1ʳᵉ période…). */
export const ANNUAL_VARIABLES: Record<string, VariableInfo> = {
    P1: { kind: "number", label: "moyenne de la 1ʳᵉ période (T1 ou S1)" },
    P2: { kind: "number", label: "moyenne de la 2ᵉ période (T2 ou S2)" },
    P3: { kind: "number", label: "moyenne de la 3ᵉ période (T3)" },
    PERIODES: { kind: "list", label: "toutes les périodes de l'année" },
};

/** Synonymes acceptés à la saisie. */
const ALIASES: Record<string, string> = {
    T1: "P1",
    T2: "P2",
    T3: "P3",
    S1: "P1",
    S2: "P2",
    INTERROGATIONS: "INTERROS",
    COMPOSITIONS: "COMPOS",
    PERIODE: "PERIODES",
};

export const FUNCTIONS: Record<string, string> = {
    MOYENNE: "moyenne de ce qui n'est pas vide",
    SOMME: "somme de ce qui n'est pas vide (0 si rien)",
    NOMBRE: "nombre de valeurs non vides",
    MIN: "plus petite valeur",
    MAX: "plus grande valeur",
};

export const SUBJECT_PRESETS = [
    {
        label: "Officielle Bénin",
        text: "moyenne(MI ; DEVOIRS ; COMPOS)",
        help: "(MI + D1 + D2 + …) ÷ (1 + nombre de devoirs) ; la composition compte comme un devoir.",
    },
    {
        label: "Moyenne de classe puis composition",
        text: "moyenne(moyenne(MI ; MD) ; MC)",
        help: "(MI + moyenne des devoirs) ÷ 2, puis moyenne avec la composition.",
    },
    {
        label: "Composition comptée deux fois",
        text: "moyenne(MI ; DEVOIRS ; COMPOS ; COMPOS)",
        help: "Comme la règle officielle, mais chaque composition pèse double.",
    },
    {
        label: "Pondération fixe",
        text: "(MI + MD + 2*MC) / 4",
        help: "Poids fixes ; s'il manque une composante (pas de composition…), la matière est « NC ».",
    },
] as const;

export const ANNUAL_PRESETS = [
    { label: "Officielle", text: "moyenne(PERIODES)", help: "(T1 + T2 + T3) ÷ 3 ou (S1 + S2) ÷ 2." },
    { label: "Dernier trimestre double", text: "(P1 + P2 + 2*P3) / 4", help: "Pour une année en trimestres." },
    { label: "Second semestre double", text: "(P1 + 2*P2) / 3", help: "Pour une année en semestres." },
] as const;

export const OFFICIAL_SUBJECT_FORMULA: string = SUBJECT_PRESETS[0].text;
export const CLASS_THEN_COMPOSITION_FORMULA: string = SUBJECT_PRESETS[1].text;
export const OFFICIAL_ANNUAL_FORMULA: string = ANNUAL_PRESETS[0].text;

// ─────────────────────────── Lecture ───────────────────────────

type OpChar = "+" | "-" | "*" | "/" | "(" | ")" | ";";

type Token =
    | { t: "num"; v: Rational; pos: number }
    | { t: "id"; v: string; pos: number }
    | { t: "op"; v: OpChar; pos: number };

export type FormulaNode =
    | { type: "num"; value: Rational }
    | { type: "var"; name: string }
    | { type: "call"; name: string; args: FormulaNode[] }
    | { type: "neg"; arg: FormulaNode }
    | { type: "bin"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode };

const MAX_LENGTH = 300;
const MAX_DEPTH = 20;
const OPERATORS: OpChar[] = ["+", "-", "*", "/", "(", ")", ";"];

function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        if (/\d/.test(c)) {
            // Décimale : 12.5 ou 12,5 (virgule collée entre deux chiffres)
            const m = /^\d+(?:[.,]\d+)?/.exec(text.slice(i))!;
            tokens.push({ t: "num", v: Rational.from(m[0].replace(",", ".")), pos: i });
            i += m[0].length;
            continue;
        }
        // × et ÷ sont dans la plage des lettres accentuées : traités avant les lettres
        if (c !== "×" && c !== "÷" && /[A-Za-zÀ-ÿ_]/.test(c)) {
            const m = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ_0-9]*/.exec(text.slice(i))!;
            tokens.push({ t: "id", v: stripAccents(m[0]).toUpperCase(), pos: i });
            i += m[0].length;
            continue;
        }
        const op = (c === "×" ? "*" : c === "÷" ? "/" : c === "," ? ";" : c) as OpChar;
        if (OPERATORS.includes(op)) {
            tokens.push({ t: "op", v: op, pos: i });
            i++;
            continue;
        }
        throw new FormulaError(`Caractère non accepté « ${c} » (position ${i + 1}).`);
    }
    return tokens;
}

/** Analyse une formule ; lève FormulaError avec un message en français. */
export function parseFormula(text: string): FormulaNode {
    const source = (text ?? "").trim();
    if (!source) throw new FormulaError("La formule est vide.");
    if (source.length > MAX_LENGTH) throw new FormulaError(`La formule dépasse ${MAX_LENGTH} caractères.`);
    const tokens = tokenize(source);
    let p = 0;
    const peek = (): Token | undefined => tokens[p];
    const isOp = (v: OpChar) => {
        const tok = peek();
        return tok?.t === "op" && tok.v === v;
    };
    const where = () => {
        const tok = peek();
        return tok ? ` (position ${tok.pos + 1})` : " en fin de formule";
    };
    const closeParen = () => {
        if (!isOp(")")) throw new FormulaError(`Parenthèse fermante « ) » attendue${where()}.`);
        p++;
    };

    const expr = (depth: number): FormulaNode => {
        if (depth > MAX_DEPTH) throw new FormulaError("Trop de parenthèses imbriquées.");
        let left = term(depth);
        while (isOp("+") || isOp("-")) {
            const op = isOp("+") ? "+" : "-";
            p++;
            left = { type: "bin", op, left, right: term(depth) };
        }
        return left;
    };
    const term = (depth: number): FormulaNode => {
        let left = unary(depth);
        while (isOp("*") || isOp("/")) {
            const op = isOp("*") ? "*" : "/";
            p++;
            left = { type: "bin", op, left, right: unary(depth) };
        }
        return left;
    };
    const unary = (depth: number): FormulaNode => {
        if (depth > MAX_DEPTH) throw new FormulaError("Formule trop imbriquée.");
        if (isOp("-")) {
            p++;
            return { type: "neg", arg: unary(depth + 1) };
        }
        if (isOp("+")) {
            p++;
            return unary(depth + 1);
        }
        return primary(depth);
    };
    const primary = (depth: number): FormulaNode => {
        const tok = peek();
        if (!tok) throw new FormulaError("La formule se termine trop tôt.");
        if (tok.t === "num") {
            p++;
            return { type: "num", value: tok.v };
        }
        if (tok.t === "id") {
            p++;
            if (isOp("(")) {
                p++;
                if (!(tok.v in FUNCTIONS)) {
                    throw new FormulaError(`Fonction inconnue « ${tok.v.toLowerCase()} » : utilisez moyenne, somme, nombre, min ou max.`);
                }
                const args: FormulaNode[] = [];
                if (!isOp(")")) {
                    args.push(expr(depth + 1));
                    while (isOp(";")) {
                        p++;
                        args.push(expr(depth + 1));
                    }
                }
                closeParen();
                if (args.length === 0) throw new FormulaError(`${tok.v.toLowerCase()}() doit contenir au moins un élément.`);
                return { type: "call", name: tok.v, args };
            }
            return { type: "var", name: ALIASES[tok.v] ?? tok.v };
        }
        if (tok.v === "(") {
            p++;
            const inner = expr(depth + 1);
            closeParen();
            return inner;
        }
        throw new FormulaError(`« ${tok.v} » inattendu (position ${tok.pos + 1}).`);
    };

    const tree = expr(0);
    const rest = peek();
    if (rest) {
        const shown = rest.t === "num" ? "nombre" : rest.v;
        throw new FormulaError(`« ${shown} » inattendu (position ${rest.pos + 1}) : il manque peut-être un opérateur.`);
    }
    return tree;
}

// ─────────────────────────── Vérification ───────────────────────────

function variablesOf(scope: FormulaScope): Record<string, VariableInfo> {
    return scope === "SUBJECT" ? SUBJECT_VARIABLES : ANNUAL_VARIABLES;
}

function listError(node: FormulaNode): FormulaError {
    const name = node.type === "var" ? node.name : "cette liste";
    return new FormulaError(`${name} est une liste de notes : écrivez moyenne(${name}), somme(${name}) ou nombre(${name}).`);
}

/** Contrôle des noms et des types : une liste ne s'additionne pas directement. */
function typeCheck(node: FormulaNode, scope: FormulaScope, used: Set<string>): VarKind {
    switch (node.type) {
        case "num":
            return "number";
        case "var": {
            const info = variablesOf(scope)[node.name];
            if (!info) {
                const known = Object.keys(variablesOf(scope)).join(", ");
                throw new FormulaError(`Variable inconnue « ${node.name} ». Variables possibles : ${known}.`);
            }
            used.add(node.name);
            return info.kind;
        }
        case "call":
            node.args.forEach((a) => typeCheck(a, scope, used));
            return "number";
        case "neg":
            if (typeCheck(node.arg, scope, used) === "list") throw listError(node.arg);
            return "number";
        case "bin":
            if (typeCheck(node.left, scope, used) === "list") throw listError(node.left);
            if (typeCheck(node.right, scope, used) === "list") throw listError(node.right);
            return "number";
    }
}

// ─────────────────────────── Calcul ───────────────────────────

/** Valeurs d'un calcul : nombre exact, vide (null) ou liste de notes. */
export type FormulaValues = Record<string, Rational | null | Rational[]>;

type Value = Rational | null | Rational[];

function flatten(values: Value[]): Rational[] {
    const out: Rational[] = [];
    for (const v of values) {
        if (v === null) continue;
        if (Array.isArray(v)) out.push(...v);
        else out.push(v);
    }
    return out;
}

function asNumber(v: Value): Rational | null {
    return Array.isArray(v) ? mean(v) : v;
}

function evaluateNode(node: FormulaNode, values: FormulaValues): Value {
    switch (node.type) {
        case "num":
            return node.value;
        case "var":
            return values[node.name] ?? null;
        case "neg": {
            const v = asNumber(evaluateNode(node.arg, values));
            return v === null ? null : v.neg();
        }
        case "call": {
            const items = flatten(node.args.map((a) => evaluateNode(a, values)));
            switch (node.name) {
                case "MOYENNE":
                    return mean(items);
                case "SOMME":
                    return sum(items);
                case "NOMBRE":
                    return Rational.int(items.length);
                case "MIN":
                    return items.length ? items.reduce((a, b) => (b.cmp(a) < 0 ? b : a)) : null;
                case "MAX":
                    return items.length ? items.reduce((a, b) => (b.cmp(a) > 0 ? b : a)) : null;
                default:
                    return null;
            }
        }
        case "bin": {
            const l = asNumber(evaluateNode(node.left, values));
            const r = asNumber(evaluateNode(node.right, values));
            if (l === null || r === null) return null;
            if (node.op === "+") return l.add(r);
            if (node.op === "-") return l.sub(r);
            if (node.op === "*") return l.mul(r);
            return r.isZero() ? null : l.div(r);
        }
    }
}

const cache = new Map<string, FormulaNode | null>();

function compiled(text: string): FormulaNode | null {
    if (cache.has(text)) return cache.get(text)!;
    let node: FormulaNode | null;
    try {
        node = parseFormula(text);
    } catch {
        node = null;
    }
    if (cache.size > 500) cache.clear();
    cache.set(text, node);
    return node;
}

/**
 * Résultat exact d'une formule ; null = vide (« NC »). Une formule illisible
 * (donnée ancienne ou corrompue) donne null plutôt qu'un nombre faux.
 */
export function evaluateFormula(text: string, values: FormulaValues): Rational | null {
    const node = compiled(text);
    return node ? asNumber(evaluateNode(node, values)) : null;
}

// ─────────────────────────── Validation avant enregistrement ───────────────────────────

const R = (x: number) => Rational.from(x);
const TWENTY = R(20);

interface SampleCase {
    name: string;
    values: FormulaValues;
    expect?: 0 | 20;
}

/** Cas types sur lesquels toute formule est essayée avant d'être acceptée. */
function sampleCases(scope: FormulaScope, periods: number): SampleCase[] {
    if (scope === "ANNUAL") {
        const make = (vals: number[]): FormulaValues => {
            const kept = vals.slice(0, periods);
            const v: FormulaValues = { PERIODES: kept.map(R) };
            kept.forEach((x, i) => (v[`P${i + 1}`] = R(x)));
            return v;
        };
        return [
            { name: "toutes les périodes à 20", values: make([20, 20, 20]), expect: 20 },
            { name: "toutes les périodes à 0", values: make([0, 0, 0]), expect: 0 },
            { name: "périodes 8 ; 12,5 ; 17", values: make([8, 12.5, 17]) },
            { name: "périodes 20 ; 0 ; 20", values: make([20, 0, 20]) },
            { name: "périodes 0 ; 20 ; 0", values: make([0, 20, 0]) },
        ];
    }
    const make = (i: number[], d: number[], c: number[]): FormulaValues => {
        const I = i.map(R);
        const D = d.map(R);
        const C = c.map(R);
        const values: FormulaValues = { INTERROS: I, DEVOIRS: D, COMPOS: C, MI: mean(I), MD: mean(D), MC: mean(C) };
        for (let k = 0; k < MAX_INDEX; k++) {
            values[`I${k + 1}`] = I[k] ?? null;
            values[`D${k + 1}`] = D[k] ?? null;
            values[`C${k + 1}`] = C[k] ?? null;
        }
        return values;
    };
    const all = (x: number) => Array.from({ length: MAX_INDEX }, () => x);
    const cases: SampleCase[] = [
        { name: "toutes les notes à 20", values: make(all(20), all(20), all(20)), expect: 20 },
        { name: "toutes les notes à 0", values: make(all(0), all(0), all(0)), expect: 0 },
    ];
    // Combinaisons de présence (interrogations, devoirs, compositions) et de valeurs extrêmes
    const sets: number[][] = [[], [0], [20], [0, 20], [20, 0, 20], [7.5, 13.25]];
    for (const i of sets) for (const d of sets) for (const c of [[], [0], [20], [12]]) {
        cases.push({ name: "cas mixte", values: make(i, d, c) });
    }
    return cases;
}

export type FormulaCheck = { ok: true; text: string } | { ok: false; error: string };

/**
 * Vérifie une formule avant de l'enregistrer : syntaxe, variables, types, et
 * résultats corrects sur des cas types (20 partout → 20, 0 partout → 0, jamais
 * hors de 0 à 20). `periods` = nombre de périodes de l'année (formule annuelle).
 */
export function validateFormula(text: string, scope: FormulaScope, periods = 3): FormulaCheck {
    try {
        const source = (text ?? "").trim();
        const tree = parseFormula(source);
        const used = new Set<string>();
        typeCheck(tree, scope, used);
        if (used.size === 0) {
            return { ok: false, error: "La formule doit utiliser au moins une note ou une moyenne (MI, MD, DEVOIRS, P1…)." };
        }
        if (scope === "ANNUAL") {
            const indexes = Array.from(used).filter((u) => /^P\d$/.test(u)).map((u) => Number(u.slice(1)));
            const max = indexes.length ? Math.max(...indexes) : 0;
            if (max > periods) {
                return { ok: false, error: `La formule utilise P${max}, mais l'année ne compte que ${periods} périodes.` };
            }
        }
        for (const c of sampleCases(scope, periods)) {
            const value = asNumber(evaluateNode(tree, c.values));
            if (c.expect !== undefined) {
                const target = c.expect === 20 ? TWENTY : Rational.ZERO;
                if (value === null || value.cmp(target) !== 0) {
                    const got = value === null ? "vide" : String(Number(value.toCents()) / 100).replace(".", ",");
                    return {
                        ok: false,
                        error: `Avec ${c.name}, la formule donne ${got} au lieu de ${c.expect}. Vérifiez les poids et le diviseur.`,
                    };
                }
            } else if (value !== null && (value.cmp(Rational.ZERO) < 0 || value.cmp(TWENTY) > 0)) {
                return { ok: false, error: "La formule peut donner un résultat hors de 0 à 20 : vérifiez les poids et le diviseur." };
            }
        }
        return { ok: true, text: source };
    } catch (error) {
        return { ok: false, error: error instanceof FormulaError ? error.message : "Formule illisible." };
    }
}

/** Anciennes valeurs (choix entre deux options) converties en formules. */
export function legacySubjectFormula(value: unknown): unknown {
    if (value === "MI_PLUS_DEVOIRS") return OFFICIAL_SUBJECT_FORMULA;
    if (value === "CLASSE_PUIS_COMPOSITION") return CLASS_THEN_COMPOSITION_FORMULA;
    return value;
}

export function legacyAnnualFormula(value: unknown, weights?: unknown): unknown {
    if (value === "MEAN") return OFFICIAL_ANNUAL_FORMULA;
    if (value === "WEIGHTED" && Array.isArray(weights) && weights.length >= 2 && weights.every((w) => Number.isInteger(w) && w > 0)) {
        const ws = weights as number[];
        const total = ws.reduce((a, b) => a + b, 0);
        const terms = ws.map((w, i) => (w === 1 ? `P${i + 1}` : `${w}*P${i + 1}`));
        return `(${terms.join(" + ")}) / ${total}`;
    }
    return value;
}
