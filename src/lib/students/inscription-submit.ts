/**
 * Envoi du dossier « Nouvelle inscription » (logique ; présentation dans la page).
 *
 * N31 : aucun mot de passe n'est envoyé. Le serveur génère un mot de passe
 * provisoire unique, renvoyé une seule fois, que l'écran affiche pour qu'il
 * soit transmis à l'élève ; celui-ci devra le changer à la première connexion (M1).
 */
export interface InscriptionSubmitInput {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    matricule: string;
    dateOfBirth: string;
    gender: string;
    birthPlace: string;
    nationality: string;
    address: string;
    classId: string;
    academicYearId: string;
}

export type InscriptionSubmitResult =
    | { ok: true; studentId: string; provisionalPassword: string | null }
    | { ok: false; error: string };

export async function submitInscription(form: InscriptionSubmitInput): Promise<InscriptionSubmitResult> {
    try {
        const res = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: form.email.trim(),
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                phone: form.phone.trim(),
                matricule: form.matricule.trim(),
                dateOfBirth: form.dateOfBirth || undefined,
                gender: form.gender || undefined,
                birthPlace: form.birthPlace.trim() || undefined,
                nationality: form.nationality.trim() || "Beninoise",
                address: form.address.trim() || undefined,
                classId: form.classId,
                academicYearId: form.academicYearId,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: data?.error || "Erreur lors de la création de l'inscription" };
        }
        return {
            ok: true,
            studentId: data?.id || data?.student?.id || "",
            provisionalPassword: typeof data?.provisionalPassword === "string" ? data.provisionalPassword : null,
        };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
    }
}
