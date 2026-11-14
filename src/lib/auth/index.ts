// AVERTISSEMENT : next-auth 5.0.0-beta.25 — version bêta épinglée volontairement.
// Ne pas mettre à jour sans lire le changelog : https://authjs.dev/getting-started/migrating-to-v5
// Dès qu'une version stable (5.x.x sans -beta) est disponible, migrer et retirer cet avertissement.
import NextAuth from "next-auth";

import { authConfig } from "./config";

// Pas d'adaptateur de base (2026-11-08) : connexion par identifiants et
// sessions JWT — l'adaptateur Prisma ne servait qu'à OAuth, aux liens
// magiques et aux sessions en base, absents ici (table `sessions` vide).
const nextAuth = NextAuth(authConfig);

export const { handlers, auth, signIn, signOut } = nextAuth;
export const { GET, POST } = handlers;
