/**
 * Nombres rationnels EXACTS (fractions BigInt) : aucune virgule flottante dans
 * les calculs de moyennes. Partagé par le moteur de calcul et le lecteur de
 * formules (formula.ts).
 */
export type DecimalLike = number | string | { toString(): string };

const B0 = BigInt(0);
const B1 = BigInt(1);
const B10 = BigInt(10);

function pow10(exponent: number): bigint {
    let result = B1;
    for (let i = 0; i < exponent; i++) result *= B10;
    return result;
}

function gcd(a: bigint, b: bigint): bigint {
    if (a < B0) a = -a;
    if (b < B0) b = -b;
    while (b !== B0) [a, b] = [b, a % b];
    return a;
}

/** Nombre rationnel exact n/d (d > 0, fraction irréductible). */
export class Rational {
    readonly n: bigint;
    readonly d: bigint;

    constructor(n: bigint, d: bigint = B1) {
        if (d === B0) throw new RangeError("Division par zéro");
        if (d < B0) {
            n = -n;
            d = -d;
        }
        const g = gcd(n, d);
        this.n = g > B1 ? n / g : n;
        this.d = g > B1 ? d / g : d;
    }

    static readonly ZERO = new Rational(B0);

    /** Valeur décimale exacte : nombre, chaîne, ou Decimal Prisma (via toString). */
    static from(value: DecimalLike): Rational {
        const text = String(value).trim();
        const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
        if (!match || (match[2] === "" && (match[3] ?? "") === "")) {
            throw new RangeError(`Valeur numérique invalide : ${text}`);
        }
        const [, sign, intPart, fracPart = "", expPart] = match;
        let n = BigInt((intPart || "0") + fracPart);
        let d = pow10(fracPart.length);
        const exp = expPart ? parseInt(expPart, 10) : 0;
        if (exp > 0) n *= pow10(exp);
        if (exp < 0) d *= pow10(-exp);
        return new Rational(sign === "-" ? -n : n, d);
    }

    static int(value: number): Rational {
        return new Rational(BigInt(value));
    }

    add(o: Rational): Rational {
        return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
    }
    mul(o: Rational): Rational {
        return new Rational(this.n * o.n, this.d * o.d);
    }
    div(o: Rational): Rational {
        return new Rational(this.n * o.d, this.d * o.n);
    }
    sub(o: Rational): Rational {
        return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
    }
    neg(): Rational {
        return new Rational(-this.n, this.d);
    }
    isPositive(): boolean {
        return this.n > B0;
    }
    isZero(): boolean {
        return this.n === B0;
    }
    /** -1, 0 ou 1. */
    cmp(o: Rational): number {
        const x = this.n * o.d - o.n * this.d;
        return x === B0 ? 0 : x > B0 ? 1 : -1;
    }

    /** Arrondi au centième, demi vers le haut (en valeur absolue), calculé en entiers. */
    toCents(rounding: "HALF_UP" | "TRUNCATE" = "HALF_UP"): bigint {
        const hundred = BigInt(100);
        const negative = this.n < B0;
        const scaled = (negative ? -this.n : this.n) * hundred;
        let q = scaled / this.d;
        if (rounding === "HALF_UP" && (scaled - q * this.d) * BigInt(2) >= this.d) q += B1;
        return negative ? -q : q;
    }
}

export function sum(values: Rational[]): Rational {
    return values.reduce((acc, v) => acc.add(v), Rational.ZERO);
}

export function mean(values: Rational[]): Rational | null {
    return values.length > 0 ? sum(values).div(Rational.int(values.length)) : null;
}

