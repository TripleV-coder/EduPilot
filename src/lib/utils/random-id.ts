/**
 * Identifiant aléatoire sûr pour les URL (remplace le paquet `nanoid`,
 * 2026-11-07) : même alphabet `A-Za-z0-9_-`, 6 bits aléatoires par caractère,
 * tirés par le générateur cryptographique de Node.
 *
 * On tire quelques octets de plus que nécessaire et on ne garde que le début
 * de l'encodage base64url : seuls des caractères complets (6 bits aléatoires
 * chacun) sont conservés, jamais le dernier caractère partiel.
 */
import { randomBytes } from "node:crypto";

export function randomId(size = 21): string {
    if (!Number.isInteger(size) || size < 1) throw new RangeError("randomId : taille entière positive attendue");
    return randomBytes(Math.ceil((size * 3) / 4) + 3)
        .toString("base64url")
        .slice(0, size);
}
