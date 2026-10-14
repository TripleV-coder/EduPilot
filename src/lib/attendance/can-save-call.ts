/**
 * Un appel « tous présents » est un appel valide : le bouton Enregistrer
 * reste actif tant que l'appel du jour n'a pas été enregistré, même si
 * aucun statut n'a été modifié (tous les élèves sont déjà « présent »).
 */
export function canSaveAttendanceCall(dirtyCount: number, callRecorded: boolean): boolean {
  return dirtyCount > 0 || !callRecorded;
}
