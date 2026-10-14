/**
 * Hachage et vérification des mots de passe (et des secrets courts : codes de
 * secours 2FA, codes de liaison parent), point de passage unique.
 *
 * `bcrypt` natif et non `bcryptjs` (analyse de capacité du 2026-10-01, G2) :
 * bcryptjs calcule en JavaScript sur le thread principal — 0,66 s de CPU par
 * vérification au coût 12, pendant lesquelles le serveur ne répond plus à
 * personne. Le module natif calcule dans le pool de threads libuv
 * (`UV_THREADPOOL_SIZE`), en parallèle et hors du thread des requêtes.
 *
 * Format identique (`$2a$`/`$2b$`) : les empreintes existantes, produites par
 * bcryptjs, restent valides sans migration.
 */
import bcrypt from "bcrypt";

/** Coût par défaut des nouvelles empreintes de mot de passe. */
export const PASSWORD_HASH_ROUNDS = 12;

/**
 * Le pool libuv est partagé : `crypto.subtle` (déchiffrement des sessions
 * Auth.js à CHAQUE requête authentifiée), `fs`, `zlib`, DNS. Mesuré : 40
 * vérifications bcrypt en file → une opération `crypto.subtle` attend 5,7 s,
 * donc toute l'application se fige pendant une rafale de connexions. On
 * laisse toujours au moins deux threads libres ; les hachages en surnombre
 * attendent ici, dans une file JavaScript qui ne coûte rien.
 */
function poolSlots(): number {
    const pool = Number(process.env.UV_THREADPOOL_SIZE) || 4;
    return Math.max(1, pool - 2);
}

let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
    if (running >= poolSlots()) {
        // Le créneau est transmis tel quel par celui qui le libère (`running`
        // inchangé) : aucun nouvel arrivant ne peut le prendre entre-temps.
        await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
        running += 1;
    }
    try {
        return await task();
    } finally {
        const next = waiting.shift();
        if (next) next();
        else running -= 1;
    }
}

export function hash(plain: string, rounds: number = PASSWORD_HASH_ROUNDS): Promise<string> {
    return withSlot(() => bcrypt.hash(plain, rounds));
}

/** `false` (jamais d'exception) pour une empreinte vide ou mal formée. */
export async function compare(plain: string, hashed: string): Promise<boolean> {
    if (!hashed) return false;
    try {
        return await withSlot(() => bcrypt.compare(plain, hashed));
    } catch {
        return false;
    }
}

const password = { hash, compare };
export default password;
