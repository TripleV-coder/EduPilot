/**
 * Kit de la recette filmée (voir playwright.recette.config.ts).
 *
 * - Un « acteur » = un navigateur connecté (ou non) dont la vidéo est rangée
 *   dans recette-videos/<étape>/<scénario>/<acteur>.webm.
 * - Chaque action passe par step() : une légende s'affiche en haut de la
 *   vidéo, le résultat (réussi / échec + message) est écrit dans le journal
 *   recette-videos/journal.jsonl, une capture est prise en cas d'échec.
 * - Tout ce qui cloche sans faire échouer l'action est aussi journalisé :
 *   erreurs console, exceptions JavaScript, réponses d'API en erreur, textes
 *   « NaN » / « undefined » à l'écran.
 * - L'état (comptes créés, mots de passe, codes, identifiants) passe d'une
 *   étape à l'autre par recette-videos/.etat.json.
 */
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const OUT = path.resolve("recette-videos");
const STATE_FILE = path.join(OUT, ".etat.json");
const JOURNAL_FILE = path.join(OUT, "journal.jsonl");
const TMP_VIDEO = path.join(OUT, ".tmp-video");
export const MAILPIT = process.env.RECETTE_MAILPIT || "http://127.0.0.1:8026";
export const SMS_GATEWAY = process.env.RECETTE_SMS || "http://127.0.0.1:8027";

fs.mkdirSync(OUT, { recursive: true });

// ─── État partagé entre étapes ───────────────────────────────────────────────

export type Account = { email: string; password: string; role: string; name: string };
type State = { accounts: Record<string, Account>; values: Record<string, string> };

function readState(): State {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as State;
    } catch {
        return { accounts: {}, values: {} };
    }
}

export const etat = {
    account(key: string): Account {
        const account = readState().accounts[key];
        if (!account) throw new Error(`Compte « ${key} » absent de l'état : l'étape qui le crée n'a pas réussi.`);
        return account;
    },
    hasAccount(key: string): boolean {
        return Boolean(readState().accounts[key]);
    },
    setAccount(key: string, account: Account) {
        const s = readState();
        s.accounts[key] = account;
        fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
    },
    get(key: string): string {
        const value = readState().values[key];
        if (value === undefined) throw new Error(`Valeur « ${key} » absente de l'état.`);
        return value;
    },
    maybe(key: string): string | undefined {
        return readState().values[key];
    },
    set(key: string, value: string) {
        const s = readState();
        s.values[key] = value;
        fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
    },
};

// ─── Journal ─────────────────────────────────────────────────────────────────

type JournalEntry = {
    etape: string;
    scenario: string;
    acteur: string;
    type: "action" | "anomalie" | "constat";
    ok?: boolean;
    ecran?: string;
    titre: string;
    detail?: string;
    capture?: string;
};

export function journal(entry: JournalEntry) {
    fs.appendFileSync(JOURNAL_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

// ─── Acteurs filmés ──────────────────────────────────────────────────────────

const CAPTION_SCRIPT = `(() => {
  const KEY = "__recette_caption";
  const draw = () => {
    let text = null;
    try { text = sessionStorage.getItem(KEY); } catch { return; }
    if (!text || !document.documentElement) return;
    let el = document.getElementById(KEY);
    if (!el) {
      el = document.createElement("div");
      el.id = KEY;
      el.setAttribute("aria-hidden", "true");
      Object.assign(el.style, {
        position: "fixed", top: "0", left: "50%", transform: "translateX(-50%)", zIndex: "2147483647",
        background: "rgba(17,24,39,.9)", color: "#fff", font: "600 13px/1.35 system-ui,sans-serif",
        padding: "5px 14px", borderRadius: "0 0 10px 10px", pointerEvents: "none", maxWidth: "94vw",
        textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      });
      document.documentElement.appendChild(el);
    }
    if (el.textContent !== text) el.textContent = text;
  };
  window.__recetteCaption = (text) => { try { sessionStorage.setItem(KEY, text); } catch { return; } draw(); };
  document.addEventListener("DOMContentLoaded", draw);
  setInterval(draw, 700);
})();`;

const slug = (s: string) =>
    s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 70);

export class Actor {
    currentStep = "";
    /** Pendant une action de refus attendu, les erreurs d'API sont des constats, pas des anomalies. */
    expectingErrors = false;
    private shots = 0;
    constructor(
        readonly page: Page,
        readonly context: BrowserContext,
        readonly etape: string,
        readonly scenario: string,
        readonly name: string,
        readonly label: string,
    ) {}

    get dir() {
        return path.join(OUT, this.etape, this.scenario);
    }

    async caption(text: string) {
        this.currentStep = text;
        await this.page
            .evaluate((t) => (window as unknown as { __recetteCaption?: (s: string) => void }).__recetteCaption?.(t), `${this.label} — ${text}`)
            .catch(() => undefined);
    }

    /** Capture numérotée de l'écran à la fin d'une action : l'album du scénario. */
    async stepShot(title: string, ok: boolean): Promise<string> {
        this.shots += 1;
        const file = path.join(this.dir, `${this.name}-${String(this.shots).padStart(3, "0")}-${ok ? "" : "ECHEC-"}${slug(title)}.png`);
        await this.page.screenshot({ path: file, timeout: 10_000 }).catch(() => undefined);
        return path.relative(OUT, file);
    }

    /** Ferme le navigateur de l'acteur et range sa vidéo. */
    async close() {
        const video = this.page.video();
        const borne = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);
        await this.page.waitForTimeout(1200).catch(() => undefined);
        // Fermeture bornée : un navigateur figé (mise en veille…) ne doit pas bloquer la recette.
        await borne(this.context.close().catch(() => undefined), 30_000);
        if (video) {
            const target = path.join(this.dir, `${this.name}.webm`);
            await borne(video.saveAs(target).catch(() => undefined), 60_000);
            await borne(video.delete().catch(() => undefined), 10_000);
        }
    }
}

const IGNORED_CONSOLE = [/Download the React DevTools/i, /\[Fast Refresh\]/i];

export async function openActor(
    browser: Browser,
    opts: {
        etape: string;
        scenario: string;
        name: string;
        label: string;
        viewport?: { width: number; height: number };
        colorScheme?: "light" | "dark";
        isMobile?: boolean;
    },
): Promise<Actor> {
    const viewport = opts.viewport ?? { width: 1280, height: 720 };
    fs.mkdirSync(path.join(OUT, opts.etape, opts.scenario), { recursive: true });
    fs.mkdirSync(TMP_VIDEO, { recursive: true });
    const context = await browser.newContext({
        baseURL: test.info().project.use.baseURL,
        viewport,
        locale: "fr-FR",
        timezoneId: "Africa/Porto-Novo",
        colorScheme: opts.colorScheme ?? "light",
        isMobile: opts.isMobile,
        hasTouch: opts.isMobile,
        recordVideo: { dir: TMP_VIDEO, size: viewport },
    });
    await context.addInitScript(CAPTION_SCRIPT);
    const page = await context.newPage();
    const actor = new Actor(page, context, opts.etape, opts.scenario, opts.name, opts.label);
    const where = () => ({ etape: opts.etape, scenario: opts.scenario, acteur: opts.label });
    page.on("console", (msg) => {
        if (msg.type() !== "error" || actor.expectingErrors) return;
        // Boîte de courriels et passerelle SMS de test : hors application.
        if (page.url().startsWith(MAILPIT) || page.url().startsWith(SMS_GATEWAY)) return;
        const text = msg.text();
        if (IGNORED_CONSOLE.some((rx) => rx.test(text))) return;
        journal({ ...where(), type: "anomalie", titre: "Erreur console", detail: `${actor.currentStep} · ${page.url()} · ${text.slice(0, 300)}` });
    });
    page.on("pageerror", (error) => {
        journal({ ...where(), type: "anomalie", titre: "Exception JavaScript", detail: `${actor.currentStep} · ${page.url()} · ${error.message.split("\n")[0]}` });
    });
    page.on("response", (response) => {
        const url = response.url();
        if (response.status() < 400 || !url.includes("/api/")) return;
        journal({
            ...where(),
            type: actor.expectingErrors ? "constat" : "anomalie",
            titre: `API ${response.status()}${actor.expectingErrors ? " (refus attendu)" : ""}`,
            detail: `${actor.currentStep} · ${response.request().method()} ${url.replace(/^https?:\/\/[^/]+/, "")}`,
        });
    });
    return actor;
}

// ─── Étapes ──────────────────────────────────────────────────────────────────

export class StepFailed extends Error {}

/**
 * Une action filmée. Échec : journalisé, capture, test marqué en échec sans
 * s'arrêter (les actions suivantes montrent la suite réelle) — sauf `critical`,
 * quand la suite n'a pas de sens sans cette action.
 */
export async function step(
    actor: Actor,
    title: string,
    fn: () => Promise<void>,
    opts: { critical?: boolean; pause?: number; refusAttendu?: boolean } = {},
) {
    await actor.caption(title);
    actor.expectingErrors = Boolean(opts.refusAttendu);
    await test.step(`${actor.label} — ${title}`, async () => {
        try {
            await fn();
            await actor.page.waitForTimeout(opts.pause ?? 700);
            await actor.caption(`${title} ✓`);
            await detectGarbage(actor, title);
            const ecran = await actor.stepShot(title, true);
            journal({ etape: actor.etape, scenario: actor.scenario, acteur: actor.label, type: "action", ok: true, titre: title, ecran });
        } catch (error) {
            const message = (error as Error).message.split("\n").filter(Boolean).slice(0, 3).join(" · ").slice(0, 500);
            await actor.caption(`${title} ✗ ÉCHEC`);
            const capture = await actor.stepShot(title, false);
            journal({ etape: actor.etape, scenario: actor.scenario, acteur: actor.label, type: "action", ok: false, titre: title, detail: message, capture, ecran: capture });
            expect.soft(false, `${actor.label} — ${title} : ${message}`).toBe(true);
            if (opts.critical) throw new StepFailed(`${title} : ${message}`);
        } finally {
            actor.expectingErrors = false;
        }
    });
}

/** Note un constat (comportement observé, sans verdict automatique). */
export function constat(actor: Actor, titre: string, detail?: string) {
    journal({ etape: actor.etape, scenario: actor.scenario, acteur: actor.label, type: "constat", titre, detail });
}

async function detectGarbage(actor: Actor, title: string) {
    const body = await actor.page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    const garbage = body.match(/\b(NaN|Infinity|undefined|\[object Object\])\b/);
    if (garbage) {
        journal({ etape: actor.etape, scenario: actor.scenario, acteur: actor.label, type: "anomalie", titre: `« ${garbage[1]} » affiché`, detail: `${title} · ${actor.page.url()}` });
    }
    if (/Une erreur inattendue est survenue|Application error|Internal Server Error/i.test(body)) {
        journal({ etape: actor.etape, scenario: actor.scenario, acteur: actor.label, type: "anomalie", titre: "Écran d'erreur", detail: `${title} · ${actor.page.url()}` });
    }
}

// ─── Gestes courants ─────────────────────────────────────────────────────────

export async function pause(actor: Actor, ms = 900) {
    await actor.page.waitForTimeout(ms);
}

export async function goto(actor: Actor, url: string) {
    const response = await actor.page.goto(url, { waitUntil: "domcontentloaded" });
    await actor.page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await actor.caption(actor.currentStep);
    return response;
}

/** Défile doucement toute la page (pour que la vidéo montre tout le contenu). */
export async function scrollThrough(actor: Actor) {
    const page = actor.page;
    const height = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
    const viewport = page.viewportSize()?.height ?? 720;
    for (let y = 0; y < height - viewport; y += Math.round(viewport * 0.7)) {
        await page.mouse.wheel(0, Math.round(viewport * 0.7));
        await page.waitForTimeout(450);
    }
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })).catch(() => undefined);
    await page.waitForTimeout(500);
}

/** Bannière cookies : acceptée comme le ferait l'utilisateur, pour qu'elle ne masque pas le bas de l'écran. */
export async function acceptCookies(actor: Actor) {
    const accept = actor.page.getByRole("button", { name: /j.accepte/i });
    if (await accept.isVisible().catch(() => false)) await accept.click().catch(() => undefined);
}

export async function login(actor: Actor, account: Pick<Account, "email" | "password">) {
    const page = actor.page;
    await goto(actor, "/login");
    await acceptCookies(actor);
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill(account.password);
    await page.getByRole("button", { name: /se connecter/i }).click();
}

/** Consentement de première connexion (conditions + confidentialité). */
export async function acceptConsent(actor: Actor, { expectVisible = false } = {}) {
    const page = actor.page;
    const heading = page.getByRole("heading", { name: /avant de continuer/i });
    if (expectVisible) {
        await expect(heading).toBeVisible({ timeout: 30_000 });
    } else {
        await page.waitForTimeout(1500);
        if (!(await heading.isVisible().catch(() => false))) return;
    }
    await pause(actor, 1200);
    await page.getByRole("checkbox", { name: /j'accepte les conditions/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();
    await expect(heading).toBeHidden({ timeout: 30_000 });
}

export async function loginToDashboard(actor: Actor, account: Pick<Account, "email" | "password">) {
    await login(actor, account);
    await actor.page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await acceptConsent(actor);
}

/** Première connexion d'un compte créé par un tiers : changement de mot de passe imposé. */
export async function firstLogin(actor: Actor, email: string, provisional: string, chosen: string) {
    const page = actor.page;
    await login(actor, { email, password: provisional });
    await page.waitForURL(/\/first-login/, { timeout: 45_000 });
    await pause(actor, 1000);
    await page.locator("#currentPassword").fill(provisional);
    await page.locator("#newPassword").fill(chosen);
    await page.locator("#confirmPassword").fill(chosen);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/login/, { timeout: 45_000 });
    await login(actor, { email, password: chosen });
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await acceptConsent(actor);
}

/** Attend un message (toast ou texte) à l'écran. */
export async function expectMessage(actor: Actor, text: RegExp) {
    await expect(actor.page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
}

/** Échoue avec le texte du message d'erreur affiché, s'il y en a un. */
export async function expectNoErrorBanner(actor: Actor) {
    const page = actor.page;
    const banner = page.locator('[role="alert"], [data-sonner-toast][data-type="error"]').filter({ hasText: /\S/ });
    if (await banner.count()) {
        const texts = (await banner.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
        const errors = texts.filter((t) => /erreur|impossible|échec|invalide|refus|requis|obligatoire/i.test(t));
        expect(errors, "message d'erreur affiché à l'écran").toEqual([]);
    }
}

/** Liste native <select> dont le libellé englobant commence par `name`. */
export function selectIn(scope: Page | Locator, name: string): Locator {
    return scope
        .locator("label")
        .filter({ has: scope.locator("select") })
        .filter({ hasText: new RegExp(`^\\s*${name}`) })
        .locator("select");
}

/** Choisit une option d'une liste Radix/shadcn ouverte par son déclencheur. */
export async function pickOption(actor: Actor, trigger: Locator, option: string | RegExp) {
    await trigger.click();
    await pause(actor, 400);
    await actor.page.getByRole("option", { name: option }).first().click();
}

// ─── Courriels et SMS de test ────────────────────────────────────────────────

type MailSummary = { ID: string };

export async function latestMail(to: string): Promise<{ id: string; subject: string; html: string; text: string } | null> {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { messages: MailSummary[] };
    const first = data.messages?.[0];
    if (!first) return null;
    const full = (await (await fetch(`${MAILPIT}/api/v1/message/${first.ID}`)).json()) as { HTML: string; Text: string; Subject: string };
    return { id: first.ID, subject: full.Subject, html: full.HTML, text: full.Text };
}

export async function smsReceived(): Promise<{ phoneNumber: string; message: string; type: string }[]> {
    const res = await fetch(`${SMS_GATEWAY}/api`);
    return res.ok ? ((await res.json()) as { phoneNumber: string; message: string; type: string }[]) : [];
}

// ─── Exploration d'une page ──────────────────────────────────────────────────

/**
 * Visite filmée d'une page : chargement, défilement complet, puis chaque onglet
 * (role=tab) avec son contenu. Journalise le statut HTTP et un éventuel refus.
 */
export async function explorePage(actor: Actor, route: string) {
    const page = actor.page;
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
    await page.waitForTimeout(900);
    await actor.caption(actor.currentStep);
    const status = response?.status() ?? 0;
    const finalPath = new URL(page.url()).pathname;
    const body = await page.locator("body").innerText().catch(() => "");
    const refused = /accès refusé|non autorisé|vous n'avez pas accès|accès restreint/i.test(body);
    const disabled = /module désactivé|n'est pas activé/i.test(body);
    constat(
        actor,
        `Page ${route}`,
        `HTTP ${status}${finalPath !== route ? ` → ${finalPath}` : ""}${refused ? " · accès refusé affiché" : ""}${disabled ? " · module désactivé" : ""}`,
    );
    if (status >= 500 || status === 404) throw new Error(`HTTP ${status}`);
    await scrollThrough(actor);
    const tabs = page.getByRole("tab");
    const count = Math.min(await tabs.count(), 12);
    for (let i = 0; i < count; i++) {
        const tab = tabs.nth(i);
        if (!(await tab.isVisible().catch(() => false))) continue;
        await tab.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
        await page.waitForTimeout(900);
        await scrollThrough(actor);
    }
}

// ─── Remplissage réaliste d'un formulaire inconnu ────────────────────────────

const inDays = (n: number) => {
    const d = new Date("2026-09-28T10:00:00");
    d.setDate(d.getDate() + n);
    return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Valeur plausible d'après le libellé du champ (français), à défaut d'une valeur imposée. */
function guessValue(label: string, type: string): string {
    const l = label.toLowerCase();
    if (type === "date") return iso(inDays(/fin|limite|retour|échéance|au$/.test(l) ? 14 : 7));
    if (type === "datetime-local") return `${iso(inDays(3))}T10:00`;
    if (type === "time") return /fin/.test(l) ? "12:00" : "10:00";
    if (type === "email" || /e-?mail|courriel/.test(l)) return "contact@recette.edupilot.test";
    if (type === "tel" || /téléphone|phone|numéro/.test(l)) return "+229 97 00 00 00";
    if (type === "number") {
        if (/montant|prix|coût|fcfa|objectif|budget|salaire/.test(l)) return "5000";
        if (/capacit|places|nombre|quantit|exemplaires|copies/.test(l)) return "20";
        if (/durée|minutes/.test(l)) return "60";
        if (/note|points|barème/.test(l)) return "20";
        return "2";
    }
    if (/isbn/.test(l)) return "978-2-7011-6090-2";
    if (/auteur/.test(l)) return "Olympe Bhêly-Quenum";
    if (/titre|intitulé|nom|libellé|objet|sujet/.test(l)) return "Recette — saisie de démonstration";
    if (/lieu|salle|adresse|arrêt|point/.test(l)) return "Cotonou, Haie Vive";
    if (/code/.test(l)) return "REC1";
    if (/url|lien/.test(l)) return "https://edupilot.test/document";
    if (/couleur/.test(l)) return "#2563EB";
    return "Saisie effectuée pendant la recette filmée, dans des conditions réelles d'utilisation.";
}

/**
 * Remplit les champs visibles vides d'un formulaire (ou d'un dialogue) :
 * `values` impose une valeur par libellé (expression régulière → valeur).
 * Listes natives et listes Radix : première option réelle si rien n'est choisi.
 */
export async function fillForm(actor: Actor, scope: Locator, values: [RegExp, string][] = []) {
    const page = actor.page;
    const fields = scope.locator("input:visible, textarea:visible, select:visible");
    const count = await fields.count();
    for (let i = 0; i < count; i++) {
        const field = fields.nth(i);
        const info = await field
            .evaluate((el) => {
                const e = el as HTMLInputElement;
                const label =
                    (e.labels && e.labels[0]?.innerText) ||
                    e.getAttribute("aria-label") ||
                    (e.getAttribute("aria-labelledby") && document.getElementById(e.getAttribute("aria-labelledby")!)?.innerText) ||
                    e.placeholder ||
                    e.name ||
                    "";
                return { tag: e.tagName, type: (e.type || "").toLowerCase(), value: e.value, label: label.trim(), disabled: e.disabled, readOnly: e.readOnly };
            })
            .catch(() => null);
        if (!info || info.disabled || info.readOnly) continue;
        if (["checkbox", "radio", "file", "submit", "button", "hidden", "search", "range", "color"].includes(info.type)) continue;
        const forced = values.find(([rx]) => rx.test(info.label))?.[1];
        if (info.tag === "SELECT") {
            if (forced) {
                const options = await field.locator("option").allInnerTexts();
                const match = options.find((o) => o.toLowerCase().includes(forced.toLowerCase()));
                if (match) await field.selectOption({ label: match }).catch(() => undefined);
            } else {
                const options = await field.locator("option").evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: o.textContent ?? "" })));
                const current = options.find((o) => o.v === info.value);
                if (!info.value || /choisir|sélectionner|--/i.test(current?.t ?? "")) {
                    const real = options.find((o) => o.v && !/choisir|sélectionner|--/i.test(o.t));
                    if (real) await field.selectOption(real.v).catch(() => undefined);
                }
            }
            continue;
        }
        if (info.value && !forced) continue;
        await field.fill(forced ?? guessValue(info.label, info.type)).catch(() => undefined);
    }
    // Listes Radix (bouton combobox) encore sur leur texte d'invite.
    const combos = scope.locator('button[role="combobox"]:visible');
    const n = await combos.count();
    for (let i = 0; i < n; i++) {
        const combo = combos.nth(i);
        const text = (await combo.innerText().catch(() => "")).trim();
        const name = (await combo.getAttribute("aria-label")) ?? "";
        const forced = values.find(([rx]) => rx.test(name) || rx.test(text))?.[1];
        if (!forced && text && !/choisir|sélectionner|select/i.test(text)) continue;
        await combo.click().catch(() => undefined);
        await page.waitForTimeout(400);
        const option = forced ? page.getByRole("option", { name: new RegExp(forced, "i") }).first() : page.getByRole("option").first();
        if (await option.isVisible().catch(() => false)) await option.click();
        else await page.keyboard.press("Escape");
    }
}

/**
 * Création générique : ouvre le formulaire (bouton `open`), le remplit, le
 * soumet (bouton `submit`) et vérifie que le formulaire se referme ou qu'un
 * message de succès apparaît.
 */
export async function createViaForm(actor: Actor, open: RegExp, submit: RegExp, values: [RegExp, string][] = []) {
    const page = actor.page;
    await page.getByRole("button", { name: open }).first().click();
    await page.waitForTimeout(900);
    const dialog = page.getByRole("dialog");
    const scope = (await dialog.count()) ? dialog.last() : page.locator("main");
    await fillForm(actor, scope, values);
    await page.waitForTimeout(800);
    await scope.getByRole("button", { name: submit }).last().click();
    await page.waitForTimeout(2200);
    const stillOpen = (await dialog.count()) > 0 && (await dialog.last().isVisible().catch(() => false));
    const success = await page.getByText(/succès|créé|créée|enregistré|enregistrée|ajouté|ajoutée|publié|publiée|programmé/i).first().isVisible().catch(() => false);
    const errorBox = page.locator('[role="alert"], [data-sonner-toast][data-type="error"]').filter({ hasText: /\S/ });
    const errors = (await errorBox.allInnerTexts().catch(() => [])).filter((t) => /erreur|impossible|échec|invalide|requis|obligatoire/i.test(t));
    expect(errors, "message d'erreur affiché").toEqual([]);
    expect(success || !stillOpen, "le formulaire doit être accepté (fermeture ou message de succès)").toBe(true);
}

// ─── Gestes génériques (étapes 07 à 11) ──────────────────────────────────────

const rxEscape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Choisit `option` (texte contenu) dans la liste nommée `name`, qu'elle soit
 * native (<select>) ou Radix (bouton combobox + options).
 */
export async function choose(actor: Actor, scope: Page | Locator, name: RegExp | string, option: string | RegExp) {
    const combo = scope.getByRole("combobox", { name: typeof name === "string" ? new RegExp(rxEscape(name), "i") : name }).first();
    await combo.waitFor({ state: "visible", timeout: 20_000 });
    await expect(combo).toBeEnabled({ timeout: 20_000 });
    const tag = await combo.evaluate((e) => e.tagName);
    const rx = typeof option === "string" ? new RegExp(rxEscape(option), "i") : option;
    if (tag === "SELECT") {
        await expect
            .poll(async () => (await combo.locator("option").allInnerTexts()).some((t) => rx.test(t)), { timeout: 20_000, message: `option ${rx} disponible` })
            .toBe(true);
        const options = await combo.locator("option").allInnerTexts();
        await combo.selectOption({ label: options.find((t) => rx.test(t))! });
    } else {
        await combo.click();
        await actor.page.waitForTimeout(400);
        await actor.page.getByRole("option", { name: rx }).first().click();
    }
    await actor.page.waitForTimeout(500);
}

/**
 * Clique `trigger` et exige un effet visible : navigation, dialogue, téléchargement,
 * message, ou changement notable du contenu. Sinon : bouton sans effet.
 */
export async function expectEffect(actor: Actor, trigger: Locator, what = "le bouton") {
    const page = actor.page;
    const before = { url: page.url(), dialogs: await page.getByRole("dialog").count(), text: (await page.locator("main").first().innerText().catch(() => "")).length };
    const download = page.waitForEvent("download", { timeout: 6000 }).catch(() => null);
    const popup = page.context().waitForEvent("page", { timeout: 6000 }).catch(() => null);
    await trigger.click();
    await page.waitForTimeout(2500);
    const after = { url: page.url(), dialogs: await page.getByRole("dialog").count(), text: (await page.locator("main").first().innerText().catch(() => "")).length };
    const toast = await page.locator("[data-sonner-toast]").count();
    const changed =
        after.url !== before.url ||
        after.dialogs > before.dialogs ||
        toast > 0 ||
        Math.abs(after.text - before.text) > 40 ||
        Boolean(await Promise.race([download, popup, page.waitForTimeout(100).then(() => null)]));
    expect(changed, `${what} doit produire un effet (navigation, fenêtre, téléchargement ou message)`).toBe(true);
}

/** Attend un téléchargement déclenché par `trigger` et renvoie son nom de fichier. */
export async function expectDownload(actor: Actor, trigger: Locator, timeout = 20_000): Promise<string> {
    const download = actor.page.waitForEvent("download", { timeout });
    await trigger.click();
    const file = await download;
    const name = file.suggestedFilename();
    await file.saveAs(path.join(actor.dir, `telechargement-${slug(name)}${path.extname(name)}`)).catch(() => undefined);
    return name;
}

/** Montre à l'écran le dernier courriel reçu par `to` (Mailpit). */
export async function showMail(actor: Actor, to: string, subject?: RegExp) {
    await expect.poll(async () => (await latestMail(to))?.subject ?? "", { timeout: 30_000, message: `courriel pour ${to}` }).toMatch(subject ?? /\S/);
    const mail = await latestMail(to);
    await actor.page.goto(`${MAILPIT}/view/${mail!.id}`);
    await actor.page.waitForTimeout(2500);
    return mail!;
}

/** Montre la passerelle SMS de test et renvoie les SMS reçus par `phone` (chiffres seuls comparés). */
export async function showSms(actor: Actor, phone: string) {
    await actor.page.goto(SMS_GATEWAY);
    await actor.page.waitForTimeout(2500);
    const digits = phone.replace(/\D/g, "").slice(-8);
    return (await smsReceived()).filter((s) => String(s.phoneNumber).replace(/\D/g, "").endsWith(digits));
}

/** Ligne (tr / li / article) contenant `text`. */
export function rowWith(scope: Page | Locator, text: string | RegExp): Locator {
    return scope.locator("tr, li, article, [role=row]").filter({ hasText: text }).first();
}
