/**
 * Password Generator Utilities
 * Génération de mots de passe temporaires et forts
 */

import crypto from 'crypto';

/**
 * Générer un mot de passe temporaire sécurisé et lisible
 * Format: XXXX-9999 (exemple: HKMP-4728)
 *
 * @returns Mot de passe temporaire (ex: "HKMP-4728")
 */
export function generateTempPassword(): string {
  // Lettres sans confusion (pas de O, I, L pour éviter confusion avec 0, 1)
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // 24 lettres
  const numbers = '23456789'; // 8 chiffres (sans 0 et 1)

  let password = '';

  // 4 lettres aléatoires
  for (let i = 0; i < 4; i++) {
    const randomIndex = crypto.randomInt(0, letters.length);
    password += letters[randomIndex];
  }

  // Séparateur
  password += '-';

  // 4 chiffres aléatoires
  for (let i = 0; i < 4; i++) {
    const randomIndex = crypto.randomInt(0, numbers.length);
    password += numbers[randomIndex];
  }

  return password; // Ex: "HKMP-4728"
}

/**
 * Générer un mot de passe temporaire court (sans tiret)
 * Format: XXX999 (exemple: HKM472)
 * Utile pour SMS ou contraintes de longueur
 *
 * @returns Mot de passe court (ex: "HKM472")
 */
export function generateShortTempPassword(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const numbers = '23456789';

  let password = '';

  // 3 lettres
  for (let i = 0; i < 3; i++) {
    password += letters[crypto.randomInt(0, letters.length)];
  }

  // 3 chiffres
  for (let i = 0; i < 3; i++) {
    password += numbers[crypto.randomInt(0, numbers.length)];
  }

  return password; // Ex: "HKM472"
}

/**
 * Générer un mot de passe fort aléatoire
 * Format: 12 caractères avec majuscules, minuscules, chiffres et spéciaux
 *
 * @param length Longueur du mot de passe (défaut: 12)
 * @returns Mot de passe fort
 */
export function generateStrongPassword(length: number = 12): string {
  const lowercase = 'abcdefghijkmnpqrstuvwxyz';
  const uppercase = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const numbers = '23456789';
  const specials = '!@#$%&*+=-';

  const allChars = lowercase + uppercase + numbers + specials;

  let password = '';

  // Garantir au moins 1 de chaque type
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += specials[crypto.randomInt(0, specials.length)];

  // Remplir avec caractères aléatoires
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }

  // Mélanger les caractères
  return password
    .split('')
    .sort(() => crypto.randomInt(0, 3) - 1)
    .join('');
}

/**
 * Valider le format d'un mot de passe temporaire
 * Accepte XXXX-9999 ou XXXX9999 (avec ou sans tiret)
 *
 * @param password Mot de passe à valider
 * @returns true si format valide
 */
export function isValidTempPasswordFormat(password: string): boolean {
  // Format avec tiret: XXXX-9999
  const regexWithDash = /^[A-Z]{4}-[0-9]{4}$/;
  // Format sans tiret: XXXX9999
  const regexWithoutDash = /^[A-Z]{4}[0-9]{4}$/;

  return regexWithDash.test(password) || regexWithoutDash.test(password);
}

/**
 * Normaliser un mot de passe temporaire (enlever le tiret)
 *
 * @param password Mot de passe (avec ou sans tiret)
 * @returns Mot de passe normalisé sans tiret
 */
export function normalizeTempPassword(password: string): string {
  return password.replace('-', '').toUpperCase();
}

/**
 * Générer un matricule unique pour un étudiant
 * Format: ANNÉE + 5 chiffres aléatoires (ex: 202512345)
 *
 * @returns Matricule unique
 */
export function generateMatricule(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(10000, 99999);
  return `${year}${random}`;
}

/**
 * Générer un numéro d'employé pour un enseignant/staff
 * Format: Préfixe + ANNÉE + 4 chiffres (ex: T20251234)
 *
 * @param prefix Préfixe du rôle ('T' pour teacher, 'D' pour director, etc.)
 * @returns Numéro d'employé
 */
export function generateEmployeeNumber(prefix: string = 'E'): string {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(1000, 9999);
  return `${prefix}${year}${random}`;
}
