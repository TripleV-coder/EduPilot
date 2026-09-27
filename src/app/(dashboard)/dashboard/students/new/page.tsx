import { redirect } from "next/navigation";

/**
 * Un seul parcours d'inscription : l'ancien formulaire « Nouvel élève » ne
 * collectait pas le responsable légal. L'adresse reste valable (favoris,
 * anciens liens) et mène à l'inscription.
 */
export default function NewStudentPage() {
    redirect("/dashboard/students/inscription");
}
