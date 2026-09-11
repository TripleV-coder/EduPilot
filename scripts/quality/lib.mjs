// Utilitaires partagés des scripts de non-régression qualité (issus de l'audit 2026-09-11).
// Ces scripts ciblent UNIQUEMENT un serveur local branché sur une base JETABLE.
import { PrismaClient } from "@prisma/client";

export const BASE = process.env.QUALITY_BASE_URL || "http://localhost:3100";

/**
 * Garde-fou : refuse toute base qui n'est pas explicitement déclarée jetable.
 * - QUALITY_DATABASE_URL doit être fournie (jamais de repli sur DATABASE_URL) ;
 * - le port 5432 (base locale du développeur) est refusé ;
 * - QUALITY_DISPOSABLE_DB=1 doit être positionné explicitement.
 */
export function disposableDbUrl() {
  const url = process.env.QUALITY_DATABASE_URL;
  if (!url) throw new Error("QUALITY_DATABASE_URL requise (base jetable uniquement).");
  if (process.env.QUALITY_DISPOSABLE_DB !== "1") {
    throw new Error("QUALITY_DISPOSABLE_DB=1 requis : confirmez que la base est jetable.");
  }
  const port = new URL(url).port || "5432";
  if (port === "5432") throw new Error("Refus : le port 5432 est réservé à la base locale réelle.");
  return url;
}

export function prismaForDisposableDb() {
  return new PrismaClient({ datasources: { db: { url: disposableDbUrl() } } });
}

let ipCounter = 1;
/** IP factice tournante : sans effet si le serveur ignore X-Forwarded-For (attendu après H3). */
export const fakeIp = () => `10.9.${(ipCounter >> 8) & 255}.${ipCounter++ & 255}`;

function jar() {
  const c = new Map();
  return {
    add(res) {
      for (const h of res.headers.getSetCookie?.() ?? []) {
        const [kv] = h.split(";");
        const i = kv.indexOf("=");
        c.set(kv.slice(0, i), kv.slice(i + 1));
      }
    },
    header() {
      return [...c].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

/** Connexion via le flux Credentials de NextAuth ; renvoie cookie + session. */
export async function login(email, password, { ip = fakeIp() } = {}) {
  const j = jar();
  const r1 = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-forwarded-for": ip } });
  j.add(r1);
  const { csrfToken } = await r1.json();
  const r2 = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: j.header(), "x-forwarded-for": ip },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/dashboard`, json: "true" }),
  });
  j.add(r2);
  const s = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: j.header(), "x-forwarded-for": ip } });
  const session = await s.json().catch(() => null);
  return { cookie: j.header(), session, status: r2.status };
}

export function pct(values, p) {
  const s = [...values].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/** Comptes de démonstration du seed (base jetable uniquement). */
export const DEMO_PASSWORD = process.env.QUALITY_PASSWORD || "Password123!";
export const ROLE_ACCOUNTS = {
  SUPER_ADMIN: "admin@edupilot.bj",
  SCHOOL_ADMIN: "admin@saintmichel.bj",
  SCHOOL_ADMIN_OTHER: "admin@lycee-behanzin.bj",
  DIRECTOR: "directeur@saintmichel.bj",
  ACCOUNTANT: "comptable@saintmichel.bj",
  TEACHER: "m.agbossou@saintmichel.bj",
  STUDENT: "kate.agbossou0@eleve.saintmichel.bj",
  PARENT: "fabrice.agbossou0@gmail.com",
};
