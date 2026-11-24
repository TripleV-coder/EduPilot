#!/usr/bin/env node
/**
 * webapp-audit.mjs — Outil de validation multi-angle pour application web
 * ----------------------------------------------------------------------------
 * Angles couverts :
 *   1. Disponibilité & TLS      DNS, certificat, protocole TLS, HTTP/2, redirections
 *   2. Sécurité                 en-têtes (CSP, HSTS…), cookies, CORS, fuites de stack,
 *                               fichiers sensibles exposés, réflexion XSS, erreurs SQL
 *   3. Performance serveur      TTFB (p50/p95), compression, cache HTTP, ETag/304
 *   4. Ressources front-end     poids JS/CSS/images, scripts bloquants, cache des assets,
 *                               source maps exposées, tiers
 *   5. SEO & contenu            title, description, viewport, canonical, OG, robots, sitemap
 *   6. Intégrité (crawl)        liens cassés, pages lentes, titres dupliqués
 *   7. Navigateur réel*         Core Web Vitals (LCP, CLS, FCP, TBT), erreurs JS, mixed
 *                               content, desktop + mobile 4G lent, débordement mobile, captures
 *   8. Accessibilité*           axe-core (WCAG 2.1 A/AA)
 *   9. Charge & scalabilité*    paliers de concurrence, RPS, p50/p95/p99, taux d'erreur,
 *                               point de saturation
 *   (* = optionnels : --browser, --load)
 *
 * Sorties : rapport HTML + JSON, scores par catégorie, comparaison avec une
 * baseline (régressions), code de sortie ≠ 0 pour la CI.
 *
 * Prérequis : Node.js ≥ 18. Aucune dépendance obligatoire.
 *   Optionnel : npm i -D playwright @axe-core/playwright && npx playwright install chromium
 *
 * ⚠  N'auditez que des applications qui vous appartiennent ou pour lesquelles vous
 *    avez une autorisation écrite (test de charge et sondes de sécurité inclus).
 */

import tls from 'node:tls';
import net from 'node:net';
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const VERSION = '1.0.0';

// ───────────────────────────── Arguments & configuration ─────────────────────────────

const HELP = `
webapp-audit ${VERSION} — validation multi-angle d'une application web

Usage :
  node webapp-audit.mjs <url> [options]

Options principales :
  --browser                 Audit navigateur réel (Web Vitals, erreurs JS, a11y) — requiert Playwright
  --load                    Test de charge par paliers (UNIQUEMENT sur votre propre app)
  --only=a,b                Modules à exécuter : security,exposure,perf,assets,seo,crawl,browser,load
  --paths=/login,/app       Pages supplémentaires à auditer dans le navigateur
  --pages=25                Nombre max de pages explorées par le crawler
  --samples=10              Nombre de mesures TTFB
  --stages=1,5,10,25,50     Paliers de concurrence du test de charge
  --stage-duration=10       Durée de chaque palier (secondes)
  --load-urls=url1,url2     URLs ciblées par le test de charge (défaut : page d'accueil)
  --header="Cookie: x=y"    En-tête ajouté à toutes les requêtes (répétable) — pour pages authentifiées
  --config=audit.config.json  Fichier de configuration (budgets, en-têtes, chemins…)
  --baseline=ancien/report.json  Compare avec un audit précédent (régressions)
  --fail-on=high            Code de sortie 1 si un problème ≥ ce niveau (critical|high|medium|low)
  --fail-on-regression      Code de sortie 1 si une métrique régresse de plus de 15 %
  --out=./audit-report      Dossier de sortie
  --timeout=15000           Timeout par requête (ms)
  --yes                     Lance le test de charge sans délai de confirmation (CI)

Variable d'environnement : CHROME_PATH=/chemin/vers/chrome pour utiliser un Chrome déjà installé.
  --help                    Cette aide

Exemples :
  node webapp-audit.mjs https://staging.monapp.com
  node webapp-audit.mjs https://staging.monapp.com --browser --paths=/login,/tableau-de-bord
  node webapp-audit.mjs http://localhost:3000 --load --stages=1,10,50,100 --stage-duration=20
  node webapp-audit.mjs https://monapp.com --baseline=./audit-precedent/report.json --fail-on=high
`;

const BOOL_FLAGS = new Set(['browser', 'load', 'help', 'fail-on-regression', 'yes']);

function parseArgs(argv) {
  const o = { _: [], header: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    let [k, v] = a.slice(2).split(/=(.*)/s);
    if (v === undefined) {
      if (BOOL_FLAGS.has(k)) v = true;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) v = argv[++i];
      else v = true;
    }
    if (k === 'header') o.header.push(v); else o[k] = v;
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args._[0]) { console.log(HELP); process.exit(args.help ? 0 : 1); }

let fileCfg = {};
if (args.config) fileCfg = JSON.parse(await fs.readFile(args.config, 'utf8'));

/** Budgets de performance — surcharger via le fichier de config ("budgets": {...}). */
const DEFAULT_BUDGETS = {
  ttfbP50Ms: 600,      // médiane du temps jusqu'au premier octet
  ttfbP95Ms: 1200,
  pageWeightKB: 2000,  // HTML + ressources de la page d'accueil (décompressé)
  jsKB: 500,
  cssKB: 150,
  requests: 80,
  lcpMs: 2500,         // seuils "Good" de Google Core Web Vitals
  cls: 0.1,
  tbtMs: 200,
  fcpMs: 1800,
  loadP95Ms: 1500,     // p95 acceptable sous charge
  loadMaxErrorRate: 0.01,
};

const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const opt = {
  pages: +(args.pages ?? fileCfg.pages ?? 25),
  samples: +(args.samples ?? fileCfg.samples ?? 10),
  timeout: +(args.timeout ?? fileCfg.timeout ?? 15000),
  out: args.out ?? fileCfg.out ?? './audit-report',
  stages: list(args.stages ?? (fileCfg.stages || [1, 5, 10, 25, 50]).join(',')).map(Number).filter((n) => n > 0),
  stageDuration: +(args['stage-duration'] ?? fileCfg.stageDuration ?? 10),
  loadUrls: list(args['load-urls'] ?? (fileCfg.loadUrls || []).join(',')),
  paths: list(args.paths ?? (fileCfg.paths || []).join(',')),
  only: list(args.only ?? (fileCfg.only || []).join(',')),
  failOn: args['fail-on'] ?? fileCfg.failOn ?? 'none',
  failOnRegression: !!(args['fail-on-regression'] ?? fileCfg.failOnRegression),
  baseline: args.baseline ?? fileCfg.baseline,
  budgets: { ...DEFAULT_BUDGETS, ...(fileCfg.budgets || {}) },
  headers: {
    'user-agent': `Mozilla/5.0 (compatible; webapp-audit/${VERSION})`,
    'accept-encoding': 'gzip, deflate, br',
    ...(fileCfg.headers || {}),
  },
};
for (const h of args.header) {
  const i = String(h).indexOf(':');
  if (i > 0) opt.headers[h.slice(0, i).trim().toLowerCase()] = h.slice(i + 1).trim();
}

let T;
try { T = new URL(args._[0]); } catch { console.error(`URL invalide : ${args._[0]}`); process.exit(1); }

// ───────────────────────────── Contexte & utilitaires ─────────────────────────────

const SEV = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEV_FR = { critical: 'Critique', high: 'Élevé', medium: 'Moyen', low: 'Faible', info: 'Info' };
const CATS = {
  tls: 'Disponibilité & TLS',
  security: 'Sécurité',
  perf: 'Performance serveur',
  assets: 'Ressources front-end',
  browser: 'Expérience réelle (Web Vitals)',
  a11y: 'Accessibilité',
  seo: 'SEO & contenu',
  crawl: 'Intégrité (liens & pages)',
  load: 'Charge & scalabilité',
};
const PENALTY = { critical: 30, high: 15, medium: 6, low: 2, info: 0 };

const ctx = { findings: [], metrics: {}, home: null, ran: new Set(), load: [], shots: [], errors: [] };

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', b: '\x1b[36m', d: '\x1b[2m', x: '\x1b[0m', B: '\x1b[1m' }
  : { r: '', y: '', g: '', b: '', d: '', x: '', B: '' };
const log = (...a) => console.log(...a);

function add(cat, sev, title, detail = '', fix = '') {
  ctx.findings.push({ cat, sev, title, detail: String(detail ?? ''), fix });
}
function metric(k, v) {
  ctx.metrics[k] = typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : v;
}
const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r0 = (n) => (n == null ? '—' : Math.round(n));
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')) || [])[1];
const preview = (arr, n = 10) => arr.slice(0, n).join('\n') + (arr.length > n ? `\n… +${arr.length - n} autres` : '');

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/** fetch chronométré : ttfb = temps jusqu'aux en-têtes, total = corps inclus. */
async function tfetch(url, { method = 'GET', headers = {}, redirect = 'follow', read = true, timeout = opt.timeout } = {}) {
  const t0 = performance.now();
  const res = await fetch(url, {
    method, redirect, headers: { ...opt.headers, ...headers }, signal: AbortSignal.timeout(timeout),
  });
  const ttfb = performance.now() - t0;
  let buf = Buffer.alloc(0);
  if (read && method !== 'HEAD') buf = Buffer.from(await res.arrayBuffer());
  else await res.body?.cancel().catch(() => {});
  return {
    status: res.status, headers: res.headers, ttfb, total: performance.now() - t0, buf,
    text: () => buf.toString('utf8'), url: res.url || url,
  };
}

const getCookies = (h) => (typeof h.getSetCookie === 'function' ? h.getSetCookie() : (h.get('set-cookie') ? [h.get('set-cookie')] : []));

function tlsInfo(host, port = 443) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const s = tls.connect({
      host, port, servername: net.isIP(host) ? undefined : host,
      ALPNProtocols: ['h2', 'http/1.1'], rejectUnauthorized: false, timeout: opt.timeout,
    }, () => {
      const c = s.getPeerCertificate();
      resolve({
        ms: performance.now() - t0, authorized: s.authorized, authError: s.authorizationError,
        protocol: s.getProtocol(), alpn: s.alpnProtocol, validTo: c.valid_to,
        issuer: c.issuer?.O || c.issuer?.CN, subject: c.subject?.CN,
      });
      s.end();
    });
    s.on('error', reject);
    s.on('timeout', () => { s.destroy(); reject(new Error('timeout TLS')); });
  });
}

async function optionalImport(name) {
  try { return await import(name); } catch { /* essai depuis le dossier courant */ }
  try {
    const req = createRequire(path.join(process.cwd(), 'noop.js'));
    return await import(pathToFileURL(req.resolve(name)).href);
  } catch { return null; }
}

// ───────────────────────────── 1. Disponibilité & TLS ─────────────────────────────

async function mConnectivity() {
  const host = T.hostname;
  try {
    const t0 = performance.now();
    const addrs = await dns.lookup(host, { all: true });
    metric('dnsMs', performance.now() - t0);
    metric('ipAddresses', addrs.map((a) => a.address).join(', '));
  } catch (e) {
    add('tls', 'critical', 'Résolution DNS impossible', e.message, 'Vérifier les enregistrements A/AAAA du domaine.');
    throw e;
  }

  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  if (T.protocol === 'https:') {
    try {
      const t = await tlsInfo(host, +(T.port || 443));
      metric('tlsHandshakeMs', t.ms);
      metric('tlsProtocol', t.protocol);
      metric('alpn', t.alpn || 'http/1.1');
      metric('certIssuer', t.issuer || '?');
      const days = Math.floor((new Date(t.validTo) - Date.now()) / 86400000);
      metric('certDaysLeft', days);
      if (!t.authorized) add('tls', 'critical', 'Certificat TLS non valide', String(t.authError),
        'Installer une chaîne complète et valide (certificat + intermédiaires), ex. Let’s Encrypt via certbot/Caddy.');
      if (days < 0) add('tls', 'critical', 'Certificat expiré', `Expiré le ${t.validTo}`, 'Renouveler immédiatement et automatiser le renouvellement.');
      else if (days < 15) add('tls', 'high', `Certificat expire dans ${days} jours`, t.validTo, 'Automatiser le renouvellement (certbot renew / Caddy / CDN).');
      else if (days < 30) add('tls', 'medium', `Certificat expire dans ${days} jours`, t.validTo, 'Vérifier que le renouvellement automatique fonctionne.');
      if (/^TLSv1(\.1)?$/.test(t.protocol)) add('tls', 'high', `Protocole TLS obsolète négocié : ${t.protocol}`, '', 'N’autoriser que TLS 1.2 et 1.3.');
      if (t.alpn !== 'h2') add('perf', 'low', 'HTTP/2 non négocié', `ALPN : ${t.alpn || 'aucun'}`,
        'Activer HTTP/2 (voire HTTP/3) sur le serveur, le reverse proxy ou le CDN : multiplexage des requêtes.');
    } catch (e) {
      add('tls', 'high', 'Handshake TLS échoué', e.message);
    }
    if (!T.port) {
      try {
        const r = await tfetch(`http://${T.host}${T.pathname}`, { redirect: 'manual', read: false, timeout: 5000 });
        const loc = r.headers.get('location') || '';
        if (!(r.status >= 300 && r.status < 400 && loc.startsWith('https://'))) {
          add('security', 'high', 'HTTP non redirigé vers HTTPS', `http:// → ${r.status} ${loc}`, 'Rediriger tout le trafic HTTP en 301 vers HTTPS.');
        } else if (![301, 308].includes(r.status)) {
          add('seo', 'low', 'Redirection HTTP→HTTPS non permanente', `Code ${r.status}`, 'Utiliser 301 ou 308.');
        }
      } catch { /* port 80 fermé : acceptable */ }
    }
  } else if (!local) {
    add('security', 'critical', 'Site servi sans HTTPS', T.href, 'Activer TLS (Let’s Encrypt est gratuit) et rediriger HTTP → HTTPS.');
  }

  // Chaîne de redirections
  let u = T.href; let hops = 0; const chain = [];
  for (; hops < 10; hops++) {
    const r = await tfetch(u, { redirect: 'manual', read: false });
    chain.push(`${r.status} ${u}`);
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) u = new URL(loc, u).href; else break;
  }
  metric('redirectHops', hops);
  if (hops >= 2) add('perf', 'low', `Chaîne de ${hops} redirections`, chain.join(' → '), 'Pointer directement vers l’URL finale (chaque saut coûte un aller-retour réseau).');

  const h = await tfetch(u);
  ctx.home = { url: u, status: h.status, headers: h.headers, html: h.text(), ttfb: h.ttfb, size: h.buf.length, cookies: getCookies(h.headers) };
  metric('homeStatus', h.status);
  metric('htmlKB', h.buf.length / 1024);
  if (h.status >= 500) add('tls', 'critical', `La page d’accueil renvoie ${h.status}`, u);
  else if (h.status >= 400) add('tls', 'high', `La page d’accueil renvoie ${h.status}`, u, 'Si la page exige une authentification, passer un cookie avec --header.');
}

// ───────────────────────────── 2. Sécurité ─────────────────────────────

async function mSecurity() {
  const H = ctx.home.headers;
  const https = new URL(ctx.home.url).protocol === 'https:';

  const csp = H.get('content-security-policy');
  if (!csp) {
    const ro = H.get('content-security-policy-report-only');
    add('security', ro ? 'medium' : 'high', ro ? 'CSP uniquement en mode report-only' : 'Content-Security-Policy absente', '',
      "Définir une CSP stricte : default-src 'self'; script-src avec nonces/hashes; object-src 'none'; base-uri 'self'; frame-ancestors 'self'.");
  } else {
    const scriptSrc = (csp.match(/script-src[^;]*/) || csp.match(/default-src[^;]*/) || [''])[0];
    if (/'unsafe-inline'/.test(scriptSrc) && !/'nonce-|'sha(256|384|512)-|'strict-dynamic'/.test(scriptSrc))
      add('security', 'medium', "CSP : 'unsafe-inline' dans script-src", scriptSrc, 'Remplacer par des nonces ou des hashes.');
    if (/'unsafe-eval'/.test(scriptSrc)) add('security', 'medium', "CSP : 'unsafe-eval' autorisé", scriptSrc, 'Supprimer eval/new Function du code et des dépendances.');
    if (/(^|\s)\*(\s|$)|(^|\s)(https?:|data:)(\s|$)/.test(scriptSrc)) add('security', 'high', 'CSP : sources de scripts trop larges', scriptSrc, 'Lister explicitement les domaines autorisés.');
  }
  if (https) {
    const hsts = H.get('strict-transport-security');
    if (!hsts) add('security', 'high', 'HSTS absent (Strict-Transport-Security)', '', 'Ajouter : Strict-Transport-Security: max-age=31536000; includeSubDomains');
    else {
      const ma = +(hsts.match(/max-age=(\d+)/i)?.[1] || 0);
      if (ma < 15552000) add('security', 'low', `HSTS max-age court (${ma}s)`, hsts, 'Viser au moins 6 mois (15552000), idéalement 1 an.');
      if (!/includesubdomains/i.test(hsts)) add('security', 'info', 'HSTS sans includeSubDomains', hsts);
    }
  }
  if ((H.get('x-content-type-options') || '').toLowerCase() !== 'nosniff')
    add('security', 'medium', 'X-Content-Type-Options: nosniff absent', '', 'Ajouter X-Content-Type-Options: nosniff.');
  if (!H.get('x-frame-options') && !/frame-ancestors/.test(csp || ''))
    add('security', 'medium', 'Protection anti-clickjacking absente', '', "Ajouter CSP frame-ancestors 'self' (ou X-Frame-Options: DENY).");
  if (!H.get('referrer-policy')) add('security', 'low', 'Referrer-Policy absente', '', 'Ajouter Referrer-Policy: strict-origin-when-cross-origin.');
  if (!H.get('permissions-policy')) add('security', 'low', 'Permissions-Policy absente', '', 'Restreindre caméra, micro, géolocalisation… ex. Permissions-Policy: camera=(), microphone=(), geolocation=()');
  if (!H.get('cross-origin-opener-policy')) add('security', 'info', 'Cross-Origin-Opener-Policy absente', '', 'Envisager COOP: same-origin (isolation contre les attaques cross-window).');
  for (const k of ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']) {
    const v = H.get(k);
    if (v && (k !== 'server' || /\d/.test(v)))
      add('security', 'low', `En-tête révélant la stack : ${k}`, v, 'Masquer les versions (nginx: server_tokens off; Express: app.disable("x-powered-by")).');
  }

  // Cookies
  for (const c of ctx.home.cookies) {
    const name = c.split('=')[0].trim();
    const a = c.toLowerCase();
    const sensitive = /sess|sid|token|auth|jwt|login|remember|csrf|xsrf/i.test(name);
    const issues = [];
    if (https && !/;\s*secure/.test(a)) issues.push('Secure');
    if (!/;\s*httponly/.test(a) && !/csrf|xsrf/i.test(name)) issues.push('HttpOnly');
    if (!/;\s*samesite=/.test(a)) issues.push('SameSite');
    if (issues.length) add('security', sensitive ? 'high' : 'low', `Cookie « ${name} » sans ${issues.join(', ')}`, c.slice(0, 200),
      'Cookies de session : Secure; HttpOnly; SameSite=Lax (ou Strict); préfixe __Host- si possible.');
  }

  // CORS : l'origine est-elle reflétée sans contrôle ?
  const corsTargets = [ctx.home.url, ...opt.loadUrls];
  for (const target of corsTargets) {
    try {
      const evil = 'https://evil-audit.example';
      const r = await tfetch(target, { headers: { origin: evil }, read: false });
      const acao = r.headers.get('access-control-allow-origin');
      const acac = r.headers.get('access-control-allow-credentials') === 'true';
      if (acao === evil) add('security', acac ? 'critical' : 'high', 'CORS : origine arbitraire acceptée', `${target}\nACAO=${acao} ACAC=${acac}`,
        'Valider l’en-tête Origin contre une liste blanche stricte ; ne jamais combiner origine reflétée et credentials.');
      else if (acao === 'null') add('security', 'medium', 'CORS : origine « null » autorisée', target, 'Retirer null de la liste blanche.');
      else if (acao === '*') add('security', 'low', 'CORS ouvert à toutes les origines (*)', target, 'Acceptable uniquement pour des ressources publiques sans authentification.');
    } catch { /* ignore */ }
  }

  // Sondes non destructives : réflexion XSS et erreurs SQL
  try {
    const probe = 'audit<x9z>"\'';
    const u = new URL(ctx.home.url); u.searchParams.set('q', probe); u.searchParams.set('id', "1'");
    const r = await tfetch(u.href);
    const body = r.text();
    if (body.includes('<x9z>')) add('security', 'high', 'Paramètre d’URL reflété sans échappement (XSS potentiel)', u.href,
      'Échapper toute donnée utilisateur à l’affichage (templating auto-escape) et renforcer la CSP.');
    if (/SQLSTATE\[|You have an error in your SQL syntax|ORA-\d{5}|PG::SyntaxError|SQLite3::|unterminated quoted string/i.test(body))
      add('security', 'critical', 'Erreur SQL renvoyée au client (injection SQL probable)', u.href, 'Requêtes paramétrées / ORM partout ; ne jamais concaténer d’entrées utilisateur.');
  } catch { /* ignore */ }
}

// ───────────────────────────── 2b. Fichiers sensibles exposés ─────────────────────────────

async function mExposure() {
  const notHtml = (b) => !/<(!doctype|html|head|body)/i.test(b);
  const isEnv = (b) => notHtml(b) && /^\s*[A-Z][A-Z0-9_]{2,}\s*=\s*\S+/m.test(b);
  const isSql = (b) => notHtml(b) && /CREATE TABLE|INSERT INTO/i.test(b);
  const isApiDoc = (b) => /"(swagger|openapi)"\s*:/.test(b);
  const probes = [
    ['/.env', isEnv, 'critical'], ['/.env.local', isEnv, 'critical'], ['/.env.production', isEnv, 'critical'],
    ['/.env.backup', isEnv, 'critical'], ['/api/.env', isEnv, 'critical'], ['/backend/.env', isEnv, 'critical'],
    ['/.git/HEAD', (b) => /^ref: refs\//.test(b), 'critical'], ['/.git/config', (b) => notHtml(b) && /\[core\]/.test(b), 'critical'],
    ['/.npmrc', (b) => notHtml(b) && /_authToken/.test(b), 'critical'],
    ['/.vscode/sftp.json', (b) => /"password"\s*:/.test(b), 'critical'],
    ['/backup.sql', isSql, 'critical'], ['/dump.sql', isSql, 'critical'], ['/db.sql', isSql, 'critical'], ['/database.sql', isSql, 'critical'],
    ['/wp-config.php.bak', (b) => /DB_PASSWORD/.test(b), 'critical'],
    ['/actuator/env', (b) => /propertySources|activeProfiles/.test(b), 'critical'],
    ['/config.json', (b) => /"(password|secret|apiKey|api_key|privateKey|client_secret)"\s*:/i.test(b), 'high'],
    ['/phpinfo.php', (b) => /PHP Version/.test(b), 'high'], ['/info.php', (b) => /PHP Version/.test(b), 'high'],
    ['/docker-compose.yml', (b) => notHtml(b) && /^services:/m.test(b), 'medium'],
    ['/server-status', (b) => /Apache Server Status/.test(b), 'medium'],
    ['/.DS_Store', (b) => b.includes('Bud1'), 'low'],
    ['/package.json', (b) => notHtml(b) && /"dependencies"\s*:/.test(b), 'low'],
    ['/composer.json', (b) => notHtml(b) && /"require"\s*:/.test(b), 'low'],
    ['/swagger.json', isApiDoc, 'info'], ['/openapi.json', isApiDoc, 'info'], ['/api/docs', (b) => /swagger-ui|redoc/i.test(b), 'info'],
  ];
  const base = new URL(ctx.home.url).origin;
  const exposed = [];
  await pool(probes, 6, async ([p, check, sev]) => {
    try {
      const r = await tfetch(base + p, { redirect: 'manual', timeout: 8000 });
      if (r.status === 200 && check(r.text().slice(0, 20000))) {
        exposed.push(p);
        add('security', sev, `Fichier sensible accessible : ${p}`, base + p,
          sev === 'info' ? 'Documentation d’API publique : vérifier que c’est voulu en production.' : 'Bloquer l’accès (règle serveur / ne pas déployer le fichier) puis faire tourner tous les secrets exposés.');
      }
    } catch { /* ignore */ }
  });
  metric('exposedFiles', exposed.length);

  // GraphQL introspection
  try {
    const r = await tfetch(`${base}/graphql?query=${encodeURIComponent('{__schema{queryType{name}}}')}`, { timeout: 8000 });
    if (r.status === 200 && /"__schema"/.test(r.text())) add('security', 'medium', 'Introspection GraphQL activée', `${base}/graphql`, 'Désactiver l’introspection en production.');
  } catch { /* ignore */ }

  // 404 : soft-404 et fuite de stack trace
  try {
    const r = await tfetch(`${base}/audit-inexistant-${Date.now().toString(36)}`);
    metric('notFoundStatus', r.status);
    if (r.status === 200) add('seo', 'low', '« Soft 404 » : une URL inexistante renvoie 200', '', 'Renvoyer un vrai statut 404 (côté serveur, ou via SSR pour une SPA).');
    const LEAK = /(Traceback \(most recent call last\)|\bat [\w.$<>]+ \([^)\s]+:\d+:\d+\)|Fatal error:|Warning: .+ on line \d+|Whitelabel Error Page|Exception in thread|DEBUG = True|Stack trace:)/i;
    if (LEAK.test(r.text())) add('security', 'high', 'Trace d’erreur interne affichée au client', r.text().match(LEAK)[0], 'Désactiver le mode debug en production ; pages d’erreur génériques ; logs côté serveur seulement.');
  } catch { /* ignore */ }

  // security.txt
  try {
    const r = await tfetch(`${base}/.well-known/security.txt`, { timeout: 5000 });
    if (r.status !== 200 || !/Contact:/i.test(r.text())) add('security', 'info', 'Pas de /.well-known/security.txt', '', 'Publier un contact sécurité (RFC 9116).');
  } catch { /* ignore */ }
}

// ───────────────────────────── 3. Performance serveur ─────────────────────────────

async function mPerf() {
  const b = opt.budgets;
  const ttfbs = []; const totals = [];
  for (let i = 0; i < opt.samples; i++) {
    const r = await tfetch(ctx.home.url);
    ttfbs.push(r.ttfb); totals.push(r.total);
  }
  const p50 = pct(ttfbs, 50); const p95 = pct(ttfbs, 95);
  metric('ttfbFirstMs', ttfbs[0]); metric('ttfbP50Ms', p50); metric('ttfbP95Ms', p95);
  metric('ttfbMaxMs', Math.max(...ttfbs)); metric('htmlDownloadP50Ms', pct(totals, 50));
  if (p50 > b.ttfbP50Ms) add('perf', p50 > 2 * b.ttfbP50Ms ? 'high' : 'medium', `TTFB médian élevé : ${r0(p50)} ms`, `Budget : ${b.ttfbP50Ms} ms (mesuré depuis la machine d’audit)`,
    'Profiler le serveur : requêtes DB (index, N+1), cache applicatif (Redis), cache CDN/edge, SSR coûteux, cold starts.');
  if (p95 > b.ttfbP95Ms) add('perf', 'medium', `Latence instable : TTFB p95 = ${r0(p95)} ms`, `Budget : ${b.ttfbP95Ms} ms`, 'Chercher les pics : GC, pool de connexions DB saturé, tâches synchrones, voisins bruyants.');
  if (ttfbs[0] > 3 * p50 && ttfbs[0] > 500) add('perf', 'low', `Démarrage à froid : 1re requête ${r0(ttfbs[0])} ms vs médiane ${r0(p50)} ms`, '', 'Préchauffage, instances minimales > 0 (serverless), cache chaud.');

  const H = ctx.home.headers;
  const enc = H.get('content-encoding');
  metric('htmlEncoding', enc || 'aucune');
  if (!enc && ctx.home.size > 1024) add('perf', 'high', 'HTML non compressé', '', 'Activer Brotli (prioritaire) et gzip sur le serveur / CDN.');
  else if (enc === 'gzip') add('perf', 'info', 'Compression gzip (Brotli serait ~15–20 % plus efficace)');

  const cc = H.get('cache-control');
  metric('htmlCacheControl', cc || 'aucun');
  if (!cc) add('perf', 'low', 'HTML sans Cache-Control', '', 'Ex. « Cache-Control: no-cache » + ETag (revalidation), ou s-maxage + stale-while-revalidate derrière un CDN.');
  const etag = H.get('etag'); const lm = H.get('last-modified');
  if (!etag && !lm) add('perf', 'low', 'Pas de validateur de cache (ETag / Last-Modified)', '', 'Activer ETag pour permettre les réponses 304.');
  else {
    try {
      const r = await tfetch(ctx.home.url, { headers: etag ? { 'if-none-match': etag } : { 'if-modified-since': lm }, read: false });
      metric('conditionalGetStatus', r.status);
      if (r.status !== 304) add('perf', 'low', 'Requête conditionnelle non honorée (pas de 304)', `Statut : ${r.status}`, 'Vérifier la génération d’ETag (ETag stable entre requêtes).');
    } catch { /* ignore */ }
  }
  if (!/text\/html/.test(H.get('content-type') || '')) add('perf', 'info', 'Type de contenu de la page d’accueil inattendu', H.get('content-type') || 'absent');
}

// ───────────────────────────── 4. Ressources front-end ─────────────────────────────

async function mAssets() {
  const b = opt.budgets;
  const html = ctx.home.html; const base = ctx.home.url;
  const origin = new URL(base).origin;
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const assets = new Map();
  const push = (u, type) => { try { const x = new URL(u, base); if (/^https?:$/.test(x.protocol)) assets.set(x.href, type); } catch { /* ignore */ } };

  let blocking = 0;
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    const tag = m[0]; const src = attr(tag, 'src'); if (!src) continue;
    push(src, 'js');
    if (head.includes(tag) && !/\s(async|defer)(\s|=|>)/i.test(tag) && !/type\s*=\s*["']module/i.test(tag)) blocking++;
  }
  let inlineJs = 0;
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) inlineJs += m[1].length;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]; const rel = (attr(tag, 'rel') || '').toLowerCase(); const href = attr(tag, 'href');
    if (!href) continue;
    if (rel.includes('stylesheet')) push(href, 'css');
    else if (rel.includes('preload') || rel.includes('modulepreload')) push(href, attr(tag, 'as') === 'style' ? 'css' : attr(tag, 'as') === 'font' ? 'font' : 'js');
  }
  let imgs = 0; let noDims = 0; let noAlt = 0; let lazy = 0;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]; imgs++;
    const src = attr(tag, 'src') || attr(tag, 'data-src');
    if (src && !src.startsWith('data:')) push(src, 'img');
    if (!attr(tag, 'width') || !attr(tag, 'height')) noDims++;
    if (attr(tag, 'alt') === undefined) noAlt++;
    if (/loading\s*=\s*["']lazy/i.test(tag)) lazy++;
  }
  metric('renderBlockingScripts', blocking);
  metric('inlineJsKB', inlineJs / 1024);
  metric('imagesInHtml', imgs);
  if (blocking) add('assets', blocking > 2 ? 'medium' : 'low', `${blocking} script(s) bloquant(s) le rendu dans <head>`, '', 'Ajouter defer (ou type="module"), ou déplacer en fin de <body>.');
  if (inlineJs > 50 * 1024) add('assets', 'low', `JS inline volumineux (${r0(inlineJs / 1024)} Ko)`, '', 'Externaliser pour bénéficier du cache ; attention aux états sérialisés (hydratation) trop gros.');
  if (noDims) add('assets', 'low', `${noDims}/${imgs} image(s) sans width/height`, '', 'Déclarer les dimensions (ou aspect-ratio en CSS) pour éviter les décalages de mise en page (CLS).');
  if (noAlt) add('a11y', 'medium', `${noAlt}/${imgs} image(s) sans attribut alt`, '', 'alt descriptif, ou alt="" pour les images décoratives.');
  if (imgs > 5 && lazy === 0) add('assets', 'low', 'Aucune image en lazy-loading', '', 'loading="lazy" pour les images sous la ligne de flottaison (pas pour l’image LCP).');
  if (!/rel\s*=\s*["']preconnect/i.test(head) && [...assets.keys()].some((u) => new URL(u).origin !== origin))
    add('assets', 'info', 'Aucun preconnect vers les domaines tiers', '', '<link rel="preconnect" href="https://cdn…"> pour les origines critiques.');

  const entries = [...assets.entries()].slice(0, 100);
  const totals = { js: 0, css: 0, img: 0, font: 0 };
  const broken = []; const uncompressed = []; const badCache = []; const bigImgs = []; const oldFmt = []; const maps = [];
  const thirdParty = new Set();
  await pool(entries, 6, async ([u, type]) => {
    try {
      const r = await tfetch(u, { timeout: 20000 });
      const ct = r.headers.get('content-type') || '';
      const size = r.buf.length;
      if (r.status >= 400) { broken.push(`${r.status} ${u}`); return; }
      totals[type] = (totals[type] || 0) + size;
      const own = new URL(u).origin === origin;
      if (!own) thirdParty.add(new URL(u).host);
      const enc = r.headers.get('content-encoding');
      if (/javascript|css|svg|json|text\//.test(ct) && size > 1400 && !enc) uncompressed.push(`${r0(size / 1024)} Ko ${u}`);
      if (own) {
        const cc = r.headers.get('cache-control') || '';
        const ma = +(cc.match(/max-age=(\d+)/)?.[1] || 0);
        const hashed = /[.-][a-f0-9]{8,}\.|[.-][A-Za-z0-9_-]{8}\.(js|css)$/.test(new URL(u).pathname);
        if (!cc || /no-store/.test(cc)) badCache.push(`aucun cache : ${u}`);
        else if (hashed && ma < 31536000 && !/immutable/.test(cc)) badCache.push(`max-age=${ma} (fichier versionné) : ${u}`);
      }
      if (type === 'img') {
        if (size > 300 * 1024) bigImgs.push(`${r0(size / 1024)} Ko ${u}`);
        if (/image\/(jpeg|png|gif)/.test(ct) && size > 50 * 1024) oldFmt.push(`${ct} ${r0(size / 1024)} Ko ${u}`);
      }
      if (type === 'js') {
        const m = r.buf.subarray(Math.max(0, size - 400)).toString().match(/sourceMappingURL=([^\s*]+)/);
        if (m && !m[1].startsWith('data:')) {
          try {
            const mu = new URL(m[1], u).href;
            const mr = await tfetch(mu, { timeout: 8000 });
            if (mr.status === 200 && /"sources"\s*:/.test(mr.text().slice(0, 5000))) maps.push(mu);
          } catch { /* ignore */ }
        }
      }
    } catch (e) { broken.push(`ERR ${u} (${e.message})`); }
  });

  const kb = (n) => n / 1024;
  const totalKB = kb(ctx.home.size + totals.js + totals.css + totals.img + totals.font);
  metric('jsKB', kb(totals.js)); metric('cssKB', kb(totals.css)); metric('imgKB', kb(totals.img)); metric('fontKB', kb(totals.font));
  metric('pageWeightKB', totalKB); metric('initialRequests', 1 + entries.length); metric('thirdPartyDomains', thirdParty.size);

  if (broken.length) add('assets', 'high', `${broken.length} ressource(s) en erreur`, preview(broken), 'Corriger les chemins / le déploiement des assets.');
  if (uncompressed.length) add('assets', 'medium', `${uncompressed.length} ressource(s) texte non compressée(s)`, preview(uncompressed), 'Activer Brotli/gzip pour JS, CSS, SVG, JSON.');
  if (badCache.length) add('assets', 'medium', `${badCache.length} ressource(s) statique(s) mal mise(s) en cache`, preview(badCache),
    'Fichiers versionnés (hash dans le nom) : Cache-Control: public, max-age=31536000, immutable.');
  if (bigImgs.length) add('assets', 'medium', `${bigImgs.length} image(s) > 300 Ko`, preview(bigImgs), 'Redimensionner, compresser, servir en AVIF/WebP avec srcset/sizes.');
  if (oldFmt.length) add('assets', 'low', `${oldFmt.length} image(s) en format ancien (JPEG/PNG/GIF > 50 Ko)`, preview(oldFmt), 'Convertir en AVIF/WebP (gain typique 30–70 %).');
  if (maps.length) add('security', 'low', `${maps.length} source map(s) publique(s)`, preview(maps), 'Ne pas publier les .map en production (ou les restreindre) : elles exposent le code source.');
  if (thirdParty.size > 8) add('assets', 'low', `${thirdParty.size} domaines tiers chargés`, [...thirdParty].join(', '), 'Chaque tiers ajoute DNS + TLS + risque : auditer, auto-héberger, charger en différé.');
  if (kb(totals.js) > b.jsKB) add('assets', kb(totals.js) > 2 * b.jsKB ? 'high' : 'medium', `JavaScript initial : ${r0(kb(totals.js))} Ko (décompressé)`, `Budget : ${b.jsKB} Ko`,
    'Code splitting par route, lazy-loading des composants lourds, tree-shaking, retirer les dépendances inutiles (analyser avec un bundle analyzer).');
  if (kb(totals.css) > b.cssKB) add('assets', 'medium', `CSS initial : ${r0(kb(totals.css))} Ko`, `Budget : ${b.cssKB} Ko`, 'Purger le CSS inutilisé, CSS critique inline, reste différé.');
  if (totalKB > b.pageWeightKB) add('assets', totalKB > 2 * b.pageWeightKB ? 'high' : 'medium', `Poids de page : ${r0(totalKB)} Ko`, `Budget : ${b.pageWeightKB} Ko — crucial sur réseau mobile et forfaits data limités`, 'Prioriser images et JS.');
  if (1 + entries.length > b.requests) add('assets', 'low', `${1 + entries.length} requêtes initiales`, `Budget : ${b.requests}`, 'Regrouper / différer.');
  add('assets', 'info', 'Analyse statique du HTML initial', 'Les ressources injectées par JavaScript (SPA) ne sont visibles qu’avec --browser.');
}

// ───────────────────────────── 5. SEO & contenu ─────────────────────────────

async function mSeo() {
  const html = ctx.home.html;
  const origin = new URL(ctx.home.url).origin;
  const meta = (name) => {
    const t = html.match(new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, 'i'))?.[0];
    return t ? (attr(t, 'content') ?? '') : null;
  };
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) add('seo', 'medium', 'Balise <title> absente ou vide', '', 'Titre unique et descriptif par page (50–60 caractères).');
  else if (title.length < 10 || title.length > 65) add('seo', 'low', `Longueur du titre : ${title.length} caractères`, title, 'Viser 30–60 caractères.');
  const desc = meta('description');
  if (desc == null) add('seo', 'medium', 'Meta description absente', '', 'Ajouter une description de 120–160 caractères.');
  else if (desc.length < 50 || desc.length > 170) add('seo', 'low', `Longueur de la meta description : ${desc.length}`, desc);
  if (meta('viewport') == null) add('seo', 'high', 'Meta viewport absente (rendu mobile cassé)', '', '<meta name="viewport" content="width=device-width, initial-scale=1">');
  else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(meta('viewport'))) add('a11y', 'medium', 'Zoom désactivé dans le viewport', meta('viewport'), 'Ne pas bloquer le zoom (WCAG 1.4.4).');
  if (!/<html[^>]*\blang\s*=/i.test(html)) add('a11y', 'medium', 'Attribut lang absent sur <html>', '', '<html lang="fr">');
  if (!/<meta[^>]+charset/i.test(html)) add('seo', 'low', 'Déclaration charset absente', '', '<meta charset="utf-8"> en tout début de <head>.');
  if (!/<link[^>]+rel\s*=\s*["']canonical/i.test(html)) add('seo', 'low', 'Lien canonical absent', '', '<link rel="canonical" href="…"> pour éviter le contenu dupliqué.');
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  metric('h1Count', h1);
  if (h1 === 0) add('seo', 'low', 'Aucun <h1> dans le HTML initial', '', 'Un h1 par page. Si la page est rendue en JS (SPA), envisager SSR/pré-rendu pour le SEO.');
  if (meta('og:title') == null || meta('og:image') == null) add('seo', 'low', 'Balises Open Graph incomplètes (og:title / og:image)', '', 'Améliore les aperçus de partage (WhatsApp, Facebook, LinkedIn).');
  if (/noindex/i.test(meta('robots') || '')) add('seo', 'medium', 'La page est en noindex', meta('robots'), 'Normal en staging, bloquant en production.');
  if (!/application\/ld\+json/i.test(html)) add('seo', 'info', 'Pas de données structurées JSON-LD', '', 'schema.org (Organization, Product, BreadcrumbList…) pour les résultats enrichis.');
  if (!/<link[^>]+rel\s*=\s*["'][^"']*icon/i.test(html)) {
    try { const r = await tfetch(`${origin}/favicon.ico`, { read: false, timeout: 5000 }); if (r.status !== 200) add('seo', 'low', 'Favicon absent'); } catch { /* ignore */ }
  }
  if (!/<link[^>]+rel\s*=\s*["']manifest/i.test(html)) add('seo', 'info', 'Pas de Web App Manifest', '', 'Manifest + service worker = installable (PWA) et utilisable hors ligne : utile sur réseau instable.');

  try {
    const r = await tfetch(`${origin}/robots.txt`, { timeout: 8000 });
    const t = r.text();
    if (r.status !== 200 || /<html/i.test(t)) add('seo', 'low', 'robots.txt absent', '', 'Publier un robots.txt avec la ligne Sitemap:.');
    else if (/User-agent:\s*\*[\s\S]*?^Disallow:\s*\/\s*$/im.test(t)) add('seo', 'medium', 'robots.txt bloque tout le site', 'Disallow: /', 'Normal en staging uniquement.');
    let sitemap = t.match(/^Sitemap:\s*(\S+)/im)?.[1] || `${origin}/sitemap.xml`;
    const s = await tfetch(sitemap, { timeout: 8000 });
    if (s.status !== 200 || !/<(urlset|sitemapindex)/i.test(s.text())) add('seo', 'low', 'sitemap.xml absent ou invalide', sitemap, 'Générer un sitemap à jour.');
  } catch { /* ignore */ }
}

// ───────────────────────────── 6. Crawl (intégrité) ─────────────────────────────

async function mCrawl() {
  const start = ctx.home.url; const origin = new URL(start).origin;
  const DANGEROUS = /logout|log-out|signout|sign-out|deconnexion|déconnexion|delete|supprimer|remove|destroy|unsubscribe/i;
  const SKIP_EXT = /\.(pdf|zip|rar|png|jpe?g|gif|webp|avif|svg|mp4|mp3|docx?|xlsx?|pptx?|csv)$/i;
  const seen = new Set([start]); const queue = [start];
  const pages = []; const broken = []; const errors = []; const titles = new Map(); const slow = [];
  while (queue.length && pages.length < opt.pages) {
    const batch = queue.splice(0, Math.min(4, opt.pages - pages.length));
    await Promise.all(batch.map(async (u) => {
      try {
        const r = await tfetch(u);
        pages.push({ url: u, status: r.status, ttfb: Math.round(r.ttfb) });
        if (r.status >= 400) { broken.push(`${r.status} ${u}`); return; }
        if (r.ttfb > opt.budgets.ttfbP95Ms * 1.5) slow.push(`${r0(r.ttfb)} ms ${u}`);
        if (!/text\/html/.test(r.headers.get('content-type') || '')) return;
        const h = r.text();
        const t = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
        if (t) titles.set(t, [...(titles.get(t) || []), u]);
        for (const m of h.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)/gi)) {
          let l; try { l = new URL(m[1], u); } catch { continue; }
          if (l.origin !== origin || SKIP_EXT.test(l.pathname) || DANGEROUS.test(l.href)) continue;
          l.hash = '';
          if (!seen.has(l.href)) { seen.add(l.href); queue.push(l.href); }
        }
      } catch (e) { errors.push(`${u} (${e.message})`); }
    }));
  }
  metric('pagesCrawled', pages.length);
  metric('brokenLinks', broken.length);
  metric('crawlTtfbP95Ms', pct(pages.map((p) => p.ttfb), 95));
  ctx.pages = pages;
  if (broken.length) add('crawl', broken.some((b) => b.startsWith('5')) ? 'high' : 'medium', `${broken.length} lien(s) interne(s) cassé(s)`, preview(broken, 15), 'Corriger les liens ou mettre en place des redirections 301.');
  if (errors.length) add('crawl', 'medium', `${errors.length} page(s) injoignable(s) / timeout`, preview(errors));
  if (slow.length) add('crawl', 'medium', `${slow.length} page(s) lente(s)`, preview(slow), 'Profiler ces routes en priorité (requêtes DB, appels externes).');
  const dups = [...titles.entries()].filter(([, us]) => us.length > 1);
  if (dups.length) add('seo', 'low', `${dups.length} titre(s) dupliqué(s) entre pages`, dups.slice(0, 5).map(([t, us]) => `« ${t} » × ${us.length}`).join('\n'), 'Un titre unique par page.');
  if (pages.length <= 1 && /<div id=["'](root|app|__next)["']>\s*<\/div>/i.test(ctx.home.html))
    add('crawl', 'info', 'SPA sans liens dans le HTML initial', 'Le crawler HTTP ne voit pas les routes rendues en JS.', 'Lister les routes clés via --paths avec --browser.');
}

// ───────────────────────────── 7 & 8. Navigateur réel + accessibilité ─────────────────────────────

async function mBrowser() {
  const pw = await optionalImport('playwright');
  if (!pw) {
    add('browser', 'info', 'Audit navigateur ignoré : Playwright non installé', '', 'npm i -D playwright @axe-core/playwright && npx playwright install chromium');
    return;
  }
  const { chromium, devices } = pw.default?.chromium ? pw.default : pw;
  const axeMod = await optionalImport('@axe-core/playwright');
  const AxeBuilder = axeMod?.default?.default || axeMod?.default || axeMod?.AxeBuilder;
  if (!AxeBuilder) add('a11y', 'info', 'Audit d’accessibilité approfondi désactivé', '', 'npm i -D @axe-core/playwright');

  const extra = Object.fromEntries(Object.entries(opt.headers).filter(([k]) => !['user-agent', 'accept-encoding'].includes(k)));
  const profiles = [
    { name: 'desktop', ctxOpts: { viewport: { width: 1366, height: 768 } }, throttle: null },
    { name: 'mobile', ctxOpts: { ...(devices['Pixel 5'] || { viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true }) },
      // ≈ « Slow 4G » de Lighthouse + CPU d'un téléphone milieu de gamme
      throttle: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, cpu: 4 } },
  ];
  const targets = [ctx.home.url, ...opt.paths.map((p) => new URL(p, ctx.home.url).href)];
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  await fs.mkdir(opt.out, { recursive: true });
  try {
    for (const target of targets) {
      const label = new URL(target).pathname || '/';
      for (const prof of profiles) {
        const context = await browser.newContext({ ...prof.ctxOpts, extraHTTPHeaders: extra });
        const page = await context.newPage();
        const consoleErrors = []; const pageErrors = []; const failed = []; const httpErrors = []; const mixed = [];
        const pageIsHttps = target.startsWith('https:');
        page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
        page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 200)));
        page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 150)}`));
        page.on('response', (r) => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url().slice(0, 150)}`); });
        page.on('request', (r) => { if (pageIsHttps && r.url().startsWith('http:')) mixed.push(r.url()); });
        await page.addInitScript(() => {
          window.__audit = { lcp: 0, cls: 0, longTasks: [] };
          try {
            new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__audit.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__audit.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
            new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__audit.longTasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
          } catch { /* navigateur sans support */ }
        });
        if (prof.throttle) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', { offline: false, ...prof.throttle, cpu: undefined });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.throttle.cpu });
        }
        try {
          await page.goto(target, { waitUntil: 'load', timeout: 90000 });
          await page.waitForTimeout(3000);
          const m = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
            let tbt = 0;
            for (const [s, d] of window.__audit.longTasks) if (fcp !== null && s >= fcp) tbt += Math.max(0, d - 50);
            const res = performance.getEntriesByType('resource');
            return {
              ttfb: nav?.responseStart ?? null, fcp, lcp: window.__audit.lcp || null, cls: window.__audit.cls, tbt,
              dcl: nav?.domContentLoadedEventEnd ?? null, load: nav?.loadEventEnd ?? null,
              requests: res.length + 1,
              transferKB: (res.reduce((a, r) => a + (r.transferSize || 0), 0) + (nav?.transferSize || 0)) / 1024,
              domNodes: document.getElementsByTagName('*').length,
              heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
              overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            };
          });
          const k = `${prof.name}${label === '/' ? '' : ':' + label}`;
          for (const [mk, mv] of Object.entries({ lcpMs: m.lcp, fcpMs: m.fcp, cls: m.cls, tbtMs: m.tbt, loadMs: m.load, transferKB: m.transferKB, requests: m.requests, domNodes: m.domNodes, heapMB: m.heapMB }))
            if (mv != null) metric(`${k}.${mk}`, mv);
          const where = `${label} (${prof.name}${prof.throttle ? ', 4G lente + CPU ×4' : ''})`;
          const B = opt.budgets;
          if (m.lcp > B.lcpMs) add('browser', m.lcp > 4000 ? 'high' : 'medium', `LCP ${r0(m.lcp)} ms — ${where}`, `Bon : ≤ ${B.lcpMs} ms`,
            'Optimiser l’élément LCP : image prioritaire (fetchpriority="high", preload, format moderne), TTFB, CSS bloquant, rendu côté serveur.');
          if (m.cls > B.cls) add('browser', m.cls > 0.25 ? 'high' : 'medium', `CLS ${m.cls.toFixed(3)} — ${where}`, `Bon : ≤ ${B.cls}`,
            'Réserver l’espace (dimensions images/iframes/pubs), font-display: optional/swap avec métriques, pas d’insertion au-dessus du contenu.');
          if (m.tbt > B.tbtMs) add('browser', m.tbt > 600 ? 'high' : 'medium', `TBT ≈ ${r0(m.tbt)} ms — ${where}`, `Bon : ≤ ${B.tbtMs} ms (proxy de l’INP)`,
            'Découper les tâches longues, moins de JS à l’hydratation, Web Workers, différer les scripts tiers.');
          if (m.fcp > B.fcpMs * (prof.throttle ? 1.5 : 1)) add('browser', 'low', `FCP ${r0(m.fcp)} ms — ${where}`, '', 'Réduire les ressources bloquantes et le TTFB.');
          if (m.domNodes > 1500) add('browser', 'low', `DOM volumineux : ${m.domNodes} nœuds — ${where}`, '', 'Virtualiser les longues listes, paginer, simplifier.');
          if (m.heapMB > 100) add('browser', 'low', `Tas JS élevé : ${r0(m.heapMB)} Mo — ${where}`, '', 'Rechercher fuites et données surdimensionnées.');
          if (m.overflow && prof.name === 'mobile') add('browser', 'medium', `Débordement horizontal sur mobile — ${label}`, '', 'Un élément dépasse la largeur d’écran : vérifier largeurs fixes, tableaux, images.');
          if (pageErrors.length) add('browser', 'high', `${pageErrors.length} exception(s) JS non gérée(s) — ${where}`, preview(pageErrors, 5), 'Corriger ; brancher un suivi d’erreurs (Sentry…).');
          if (consoleErrors.length) add('browser', 'medium', `${consoleErrors.length} erreur(s) console — ${where}`, preview(consoleErrors, 5));
          if (failed.length) add('browser', 'medium', `${failed.length} requête(s) échouée(s) — ${where}`, preview(failed, 5));
          if (httpErrors.length) add('browser', 'medium', `${httpErrors.length} réponse(s) HTTP ≥ 400 — ${where}`, preview(httpErrors, 5));
          if (mixed.length) add('security', 'high', `Contenu mixte (HTTP sur page HTTPS) — ${label}`, preview(mixed, 5), 'Tout charger en HTTPS ; CSP upgrade-insecure-requests.');

          const shot = `screenshot-${prof.name}-${label === '/' ? 'accueil' : label.replace(/[^\w]+/g, '_')}.png`;
          await page.screenshot({ path: path.join(opt.out, shot) }).catch(() => {});
          ctx.shots.push({ file: shot, label: where });

          if (AxeBuilder && prof.name === 'desktop') {
            const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
            metric(`a11y${label === '/' ? '' : ':' + label}.violations`, res.violations.length);
            for (const v of res.violations) {
              const sev = { critical: 'high', serious: 'medium', moderate: 'low', minor: 'info' }[v.impact] || 'low';
              add('a11y', sev, `${v.help} — ${v.nodes.length} élément(s) — ${label}`, `${v.id} · ex. ${v.nodes[0]?.target?.join(' ') ?? ''}`, v.helpUrl);
            }
          }
          log(`   ${C.d}${where} : LCP ${r0(m.lcp)} ms · CLS ${m.cls?.toFixed(3)} · TBT ${r0(m.tbt)} ms · ${r0(m.transferKB)} Ko${C.x}`);
        } catch (e) {
          add('browser', 'high', `Chargement impossible — ${where}`, e.message);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (AxeBuilder) ctx.ran.add('a11y');
}

// ───────────────────────────── 9. Charge & scalabilité ─────────────────────────────

async function mLoad() {
  const urls = opt.loadUrls.length ? opt.loadUrls : [ctx.home.url];
  const B = opt.budgets;
  log(`${C.y}   ⚠ Test de charge sur ${urls.join(', ')} — paliers ${opt.stages.join('/')} × ${opt.stageDuration}s.`);
  log(`     N’exécutez ceci que sur VOTRE application (idéalement un staging iso-prod).${C.x}`);
  if (!args.yes) { log(`${C.d}     Démarrage dans 5 s (Ctrl+C pour annuler, --yes pour sauter)…${C.x}`); await sleep(5000); }

  let maxHealthy = 0;
  for (const c of opt.stages) {
    const lat = []; let ok = 0; let err = 0; const codes = {};
    const end = performance.now() + opt.stageDuration * 1000; let i = 0;
    const worker = async () => {
      while (performance.now() < end) {
        const u = urls[i++ % urls.length]; const t0 = performance.now();
        try {
          const r = await tfetch(u, { timeout: Math.max(opt.timeout, 30000) });
          lat.push(performance.now() - t0);
          codes[r.status] = (codes[r.status] || 0) + 1;
          if (r.status >= 500 || r.status === 429) err++; else ok++;
        } catch {
          err++; lat.push(performance.now() - t0); codes.ERR = (codes.ERR || 0) + 1;
        }
      }
    };
    const t0 = performance.now();
    await Promise.all(Array.from({ length: c }, worker));
    const secs = (performance.now() - t0) / 1000;
    const st = { concurrency: c, requests: ok + err, rps: (ok + err) / secs, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), errorRate: err / Math.max(1, ok + err), codes };
    ctx.load.push(st);
    const healthy = st.errorRate <= B.loadMaxErrorRate && st.p95 <= B.loadP95Ms;
    if (healthy) maxHealthy = c;
    const col = healthy ? C.g : C.r;
    log(`   ${col}${String(c).padStart(4)} conc. │ ${st.rps.toFixed(1).padStart(7)} req/s │ p50 ${String(r0(st.p50)).padStart(5)} │ p95 ${String(r0(st.p95)).padStart(5)} │ p99 ${String(r0(st.p99)).padStart(5)} ms │ erreurs ${(st.errorRate * 100).toFixed(1)} %${C.x}`);
    if (st.errorRate > 0.25 || st.p95 > B.loadP95Ms * 4) { log(`${C.r}   Saturation atteinte — arrêt des paliers.${C.x}`); break; }
    await sleep(2000);
  }
  metric('loadMaxHealthyConcurrency', maxHealthy);
  metric('loadPeakRps', Math.max(...ctx.load.map((s) => s.rps)));
  const first = ctx.load[0]; const last = ctx.load[ctx.load.length - 1];
  const table = ctx.load.map((s) => `${s.concurrency} conc. → ${s.rps.toFixed(1)} req/s, p95 ${r0(s.p95)} ms, ${(s.errorRate * 100).toFixed(1)} % err, codes ${JSON.stringify(s.codes)}`).join('\n');
  if (maxHealthy === 0) add('load', 'high', 'Dégradation dès le premier palier de charge', table, 'Profiler le serveur (APM), vérifier pool DB, workers/threads, limites du conteneur.');
  else if (maxHealthy < opt.stages[opt.stages.length - 1]) add('load', 'medium', `Capacité saine jusqu’à ${maxHealthy} requêtes simultanées`, table,
    'Comparer au pic attendu (×3 de marge). Leviers : cache, index DB, pool de connexions, scaling horizontal, file d’attente pour les tâches lourdes, CDN.');
  else add('load', 'info', `Tous les paliers tenus (jusqu’à ${maxHealthy} simultanés)`, table, 'Pousser plus loin avec k6/Artillery depuis plusieurs machines pour trouver la limite.');
  if (last && first && first.p95 > 0 && last.p95 > 200 && last.p95 / first.p95 > 4) add('load', 'medium', `Latence p95 ×${(last.p95 / first.p95).toFixed(1)} entre ${first.concurrency} et ${last.concurrency} utilisateurs`, '', 'Contention : verrous DB, pool trop petit, CPU saturé, traitement synchrone.');
  if (ctx.load.some((s) => s.codes[429])) add('load', 'info', 'Rate limiting détecté (429)', '', 'Bon signe côté protection ; vérifier que les seuils conviennent aux usages légitimes.');
  add('load', 'info', 'Limites de ce test de charge', '', 'Un seul client Node, même réseau : pour >500 utilisateurs virtuels, scénarios réalistes (login → parcours) et tests d’endurance, utiliser k6, Gatling ou Artillery.');
}

// ───────────────────────────── Orchestration ─────────────────────────────

const MODULES = [
  { name: 'security', cats: ['security'], fn: mSecurity, def: true },
  { name: 'exposure', cats: ['security'], fn: mExposure, def: true },
  { name: 'perf', cats: ['perf'], fn: mPerf, def: true },
  { name: 'assets', cats: ['assets'], fn: mAssets, def: true },
  { name: 'seo', cats: ['seo'], fn: mSeo, def: true },
  { name: 'crawl', cats: ['crawl'], fn: mCrawl, def: true },
  { name: 'browser', cats: ['browser'], fn: mBrowser, def: !!args.browser },
  { name: 'load', cats: ['load'], fn: mLoad, def: !!args.load },
];

function computeScores() {
  const s = {};
  for (const k of Object.keys(CATS)) {
    if (!ctx.ran.has(k)) continue;
    let v = 100;
    for (const f of ctx.findings) if (f.cat === k) v -= PENALTY[f.sev];
    s[k] = Math.max(0, v);
  }
  const vals = Object.values(s);
  s.global = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  return s;
}

async function compareBaseline(report) {
  if (!opt.baseline) return null;
  let prev;
  try { prev = JSON.parse(await fs.readFile(opt.baseline, 'utf8')); } catch (e) { log(`${C.y}Baseline illisible : ${e.message}${C.x}`); return null; }
  const regressions = []; const improvements = [];
  for (const [k, v] of Object.entries(report.metrics)) {
    const p = prev.metrics?.[k];
    if (typeof v !== 'number' || typeof p !== 'number' || p === 0) continue;
    const higherBetter = /rps|healthy|daysleft|score/i.test(k);
    const delta = (v - p) / Math.abs(p);
    const worse = higherBetter ? delta < -0.15 : delta > 0.15;
    const better = higherBetter ? delta > 0.15 : delta < -0.15;
    const line = { metric: k, before: p, after: v, deltaPct: Math.round(delta * 100) };
    if (worse) regressions.push(line); else if (better) improvements.push(line);
  }
  const key = (f) => `${f.cat}|${f.title.replace(/\d+(\.\d+)?/g, '#')}`;
  const prevKeys = new Set((prev.findings || []).map(key));
  const curKeys = new Set(report.findings.map(key));
  return {
    date: prev.date, previousScores: prev.scores, regressions, improvements,
    newFindings: report.findings.filter((f) => !prevKeys.has(key(f)) && f.sev !== 'info').map((f) => f.title),
    resolvedFindings: (prev.findings || []).filter((f) => !curKeys.has(key(f)) && f.sev !== 'info').map((f) => f.title),
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const scoreColor = (v) => (v >= 90 ? '#0c8a4f' : v >= 70 ? '#b7791f' : '#c53030');

function renderHtml(rep) {
  const sevOrder = Object.keys(SEV);
  const cards = Object.entries(rep.scores).filter(([k]) => k !== 'global').map(([k, v]) =>
    `<div class="card"><div class="score" style="color:${scoreColor(v)}">${v}</div><div>${esc(CATS[k])}</div>
     <div class="muted">${rep.findings.filter((f) => f.cat === k && f.sev !== 'info').length} problème(s)</div></div>`).join('');
  const counts = sevOrder.map((s) => `<button class="f" data-s="${s}"><span class="sev ${s}">${SEV_FR[s]}</span> ${rep.findings.filter((f) => f.sev === s).length}</button>`).join('');
  const rows = rep.findings.map((f) => `<tr data-s="${f.sev}"><td><span class="sev ${f.sev}">${SEV_FR[f.sev]}</span></td><td>${esc(CATS[f.cat] || f.cat)}</td>
     <td><b>${esc(f.title)}</b>${f.detail ? `<pre>${esc(f.detail)}</pre>` : ''}</td><td>${/^https?:/.test(f.fix) ? `<a href="${esc(f.fix)}" target="_blank" rel="noopener">Documentation</a>` : esc(f.fix)}</td></tr>`).join('');
  const metrics = Object.entries(rep.metrics).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join('');
  const load = rep.load.length ? `<h2>Test de charge</h2><table><tr><th>Concurrence</th><th>Requêtes</th><th>Req/s</th><th>p50</th><th>p95</th><th>p99</th><th>Erreurs</th><th>Codes</th></tr>
     ${rep.load.map((s) => `<tr><td>${s.concurrency}</td><td>${s.requests}</td><td>${s.rps.toFixed(1)}</td><td>${r0(s.p50)} ms</td><td>${r0(s.p95)} ms</td><td>${r0(s.p99)} ms</td><td>${(s.errorRate * 100).toFixed(1)} %</td><td><code>${esc(JSON.stringify(s.codes))}</code></td></tr>`).join('')}</table>` : '';
  const shots = rep.screenshots.length ? `<h2>Captures</h2><div class="shots">${rep.screenshots.map((s) => `<figure><img src="${esc(s.file)}" alt="${esc(s.label)}"><figcaption>${esc(s.label)}</figcaption></figure>`).join('')}</div>` : '';
  const b = rep.baseline;
  const base = b ? `<h2>Comparaison avec l’audit du ${esc(b.date)}</h2>
     <p>Score global : ${b.previousScores?.global ?? '?'} → <b>${rep.scores.global}</b></p>
     ${b.regressions.length ? `<h3>Régressions (&gt; 15 %)</h3><ul>${b.regressions.map((r) => `<li><code>${esc(r.metric)}</code> : ${r.before} → <b>${r.after}</b> (${r.deltaPct > 0 ? '+' : ''}${r.deltaPct} %)</li>`).join('')}</ul>` : '<p>Aucune régression de métrique.</p>'}
     ${b.improvements.length ? `<h3>Améliorations</h3><ul>${b.improvements.map((r) => `<li><code>${esc(r.metric)}</code> : ${r.before} → <b>${r.after}</b> (${r.deltaPct} %)</li>`).join('')}</ul>` : ''}
     ${b.newFindings.length ? `<h3>Nouveaux problèmes</h3><ul>${b.newFindings.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
     ${b.resolvedFindings.length ? `<h3>Problèmes résolus</h3><ul>${b.resolvedFindings.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}` : '';
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Audit — ${esc(rep.url)}</title><style>
body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f6f7f9;color:#1a202c}
main{max-width:1200px;margin:auto;padding:24px}h1{margin:0 0 4px}h2{margin-top:36px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
.muted{color:#718096;font-size:13px}.hero{display:flex;gap:24px;align-items:center;background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 3px #0001}
.big{font-size:56px;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-top:16px}
.card{background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 3px #0001}.score{font-size:30px;font-weight:700}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px #0001}
td,th{padding:8px 10px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:13px}
pre{white-space:pre-wrap;word-break:break-all;font-size:12px;color:#4a5568;margin:6px 0 0}
.sev{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
.critical{background:#9b2c2c}.high{background:#e53e3e}.medium{background:#dd6b20}.low{background:#3182ce}.info{background:#a0aec0}
.f{border:1px solid #cbd5e0;background:#fff;border-radius:8px;padding:6px 10px;margin:0 6px 8px 0;cursor:pointer}.f.off{opacity:.35}
.shots{display:flex;gap:16px;flex-wrap:wrap}.shots img{max-width:360px;border:1px solid #e2e8f0;border-radius:8px}figcaption{font-size:12px;color:#718096}
</style></head><body><main>
<div class="hero"><div class="big" style="color:${scoreColor(rep.scores.global)}">${rep.scores.global}</div>
<div><h1>Audit de ${esc(rep.url)}</h1><div class="muted">${esc(rep.date)} · webapp-audit ${VERSION} · durée ${rep.durationSec}s · modules : ${esc(rep.modules.join(', '))}</div></div></div>
<div class="grid">${cards}</div>
${base}
<h2>Problèmes détectés (${rep.findings.length})</h2><div>${counts}</div>
<table id="t"><tr><th>Gravité</th><th>Catégorie</th><th>Constat</th><th>Correctif conseillé</th></tr>${rows}</table>
${load}${shots}
<h2>Métriques brutes</h2><table>${metrics}</table>
<p class="muted">Scores : 100 − pénalités (critique 30, élevé 15, moyen 6, faible 2). Mesures prises depuis la machine d’audit : relancer depuis la région de vos utilisateurs pour des chiffres représentatifs.</p>
</main><script>
document.querySelectorAll('.f').forEach(b=>b.onclick=()=>{b.classList.toggle('off');const off=[...document.querySelectorAll('.f.off')].map(x=>x.dataset.s);
document.querySelectorAll('#t tr[data-s]').forEach(r=>r.style.display=off.includes(r.dataset.s)?'none':'')});
</script></body></html>`;
}

async function main() {
  const t0 = Date.now();
  log(`\n${C.B}webapp-audit ${VERSION}${C.x} → ${C.b}${T.href}${C.x}\n`);
  const selected = MODULES.filter((m) => (opt.only.length ? opt.only.includes(m.name) : m.def));

  log(`${C.B}▸ connectivité & TLS${C.x}`);
  try { await mConnectivity(); ctx.ran.add('tls'); } catch (e) {
    log(`${C.r}Cible injoignable : ${e.message}${C.x}`); process.exitCode = 2; return;
  }
  for (const m of selected) {
    log(`${C.B}▸ ${m.name}${C.x}`);
    const t = Date.now();
    try { await m.fn(); m.cats.forEach((c) => ctx.ran.add(c)); } catch (e) {
      ctx.errors.push(`${m.name}: ${e.message}`);
      add(m.cats[0], 'info', `Module « ${m.name} » interrompu (exclu du score)`, e.message.split('\n')[0]);
      log(`${C.r}   Module interrompu : ${e.message.split('\n')[0]}${C.x}`);
    }
    log(`${C.d}   ${((Date.now() - t) / 1000).toFixed(1)}s${C.x}`);
  }

  ctx.findings.sort((a, b) => SEV[b.sev] - SEV[a.sev] || a.cat.localeCompare(b.cat));
  const report = {
    tool: `webapp-audit ${VERSION}`, url: T.href, date: new Date().toISOString(), durationSec: Math.round((Date.now() - t0) / 1000),
    modules: ['connectivity', ...selected.map((m) => m.name)], budgets: opt.budgets, scores: computeScores(),
    metrics: ctx.metrics, findings: ctx.findings, load: ctx.load, pages: ctx.pages || [], screenshots: ctx.shots, errors: ctx.errors,
  };
  report.baseline = await compareBaseline(report);

  await fs.mkdir(opt.out, { recursive: true });
  await fs.writeFile(path.join(opt.out, 'report.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(opt.out, 'report.html'), renderHtml(report));

  // Résumé console
  log(`\n${C.B}Scores${C.x}`);
  for (const [k, v] of Object.entries(report.scores)) {
    const col = v >= 90 ? C.g : v >= 70 ? C.y : C.r;
    log(`  ${(k === 'global' ? 'GLOBAL' : CATS[k]).padEnd(32)} ${col}${String(v).padStart(3)}${C.x}`);
  }
  const top = ctx.findings.filter((f) => SEV[f.sev] >= SEV.medium).slice(0, 12);
  if (top.length) {
    log(`\n${C.B}Priorités${C.x}`);
    for (const f of top) log(`  ${(f.sev === 'critical' || f.sev === 'high') ? C.r : C.y}[${SEV_FR[f.sev]}]${C.x} ${f.title}`);
  }
  if (report.baseline?.regressions.length) {
    log(`\n${C.r}${C.B}Régressions vs baseline${C.x}`);
    for (const r of report.baseline.regressions) log(`  ${r.metric}: ${r.before} → ${r.after} (${r.deltaPct > 0 ? '+' : ''}${r.deltaPct} %)`);
  }
  log(`\nRapport : ${C.b}${path.resolve(opt.out, 'report.html')}${C.x}\n`);

  if (opt.failOn !== 'none' && SEV[opt.failOn] !== undefined && ctx.findings.some((f) => SEV[f.sev] >= SEV[opt.failOn])) process.exitCode = 1;
  if (opt.failOnRegression && report.baseline?.regressions.length) process.exitCode = 1;
}

await main();
