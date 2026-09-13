import { hash } from "bcryptjs";
import { generateTempPassword } from "./password-generator";

/**
 * Mot de passe provisoire d'un compte créé par un tiers (admin, import) — M1 / N31.
 *
 * Un secret DIFFÉRENT par compte, lisible (« HKMP-4728 ») pour être transmis
 * de vive voix ou sur papier, communiqué une seule fois à l'auteur de la
 * création. Le compte naît avec `mustChangePassword` : le middleware le
 * confine à /first-login jusqu'au choix d'un mot de passe définitif. Le
 * verrouillage de compte et la limite d'échecs par adresse (H4) bornent la
 * devinette pendant cette fenêtre.
 */
export interface ProvisionalPassword {
    plain: string;
    hash: string;
}

export async function issueProvisionalPassword(rounds = 10): Promise<ProvisionalPassword> {
    const plain = generateTempPassword();
    return { plain, hash: await hash(plain, rounds) };
}

/** Identifiant renvoyé une seule fois dans la réponse d'un import. */
export interface ProvisionalCredential {
    row: number;
    email: string;
    firstName: string;
    lastName: string;
    provisionalPassword: string;
}
