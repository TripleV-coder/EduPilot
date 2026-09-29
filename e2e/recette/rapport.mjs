#!/usr/bin/env node
/**
 * Rapport de la recette filmée.
 *
 *   node e2e/recette/rapport.mjs [--sans-conversion]
 *
 * - Convertit chaque vidéo .webm de recette-videos/ en .mp4 (H.264, lisible
 *   partout) à côté de l'original, puis supprime le .webm.
 * - Écrit recette-videos/index.html : sommaire par étape et scénario, vidéos
 *   intégrées, capture d'écran de chaque action (album du scénario), résultat
 *   de chaque action, anomalies et constats.
 * - Écrit recette-videos/RAPPORT.md : chiffres, échecs (avec capture),
 *   anomalies regroupées.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("recette-videos");
const convert = !process.argv.includes("--sans-conversion");

const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        if (d.name.startsWith(".")) return [];
        const full = path.join(dir, d.name);
        return d.isDirectory() ? walk(full) : [full];
    });

if (convert) {
    for (const webm of walk(OUT).filter((f) => f.endsWith(".webm"))) {
        const mp4 = webm.replace(/\.webm$/, ".mp4");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
        fs.unlinkSync(webm);
        process.stdout.write(`vidéo : ${path.relative(OUT, mp4)}\n`);
    }
}

const journal = fs.existsSync(path.join(OUT, "journal.jsonl"))
    ? fs
          .readFileSync(path.join(OUT, "journal.jsonl"), "utf8")
          .split("\n")
          .filter(Boolean)
          .flatMap((l) => {
              try {
                  return [JSON.parse(l)];
              } catch {
                  return [];
              }
          })
    : [];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const clean = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, "");
const human = (slug) => slug.replace(/^\d\d-/, "").replace(/-/g, " ");

// Étapes → scénarios → vidéos + entrées du journal.
const etapes = new Map();
const etapeDirs = fs
    .readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d\d-/.test(d.name))
    .map((d) => d.name)
    .sort();
for (const dir of etapeDirs) {
    const scenarios = new Map();
    const scDirs = fs
        .readdirSync(path.join(OUT, dir), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
    for (const sc of scDirs) {
        const files = fs.readdirSync(path.join(OUT, dir, sc)).sort();
        scenarios.set(sc, {
            videos: files.filter((f) => /\.(mp4|webm)$/.test(f)).map((f) => `${dir}/${sc}/${f}`),
            entries: journal.filter((e) => e.etape === dir && e.scenario === sc),
        });
    }
    etapes.set(dir, scenarios);
}

const actions = journal.filter((e) => e.type === "action");
const echecs = actions.filter((e) => e.ok === false);
const anomalies = journal.filter((e) => e.type === "anomalie");
const videos = [...etapes.values()].flatMap((s) => [...s.values()].flatMap((x) => x.videos));
const captures = actions.filter((e) => e.ecran).length;

// ─── RAPPORT.md ──────────────────────────────────────────────────────────────
const grouped = new Map();
for (const a of anomalies) {
    const where = clean(a.detail).replace(/^[^·]*· /, "").replace(/\?.*$/, "").replace(/[a-z0-9]{20,}/g, ":id").slice(0, 160);
    const key = `${a.titre} · ${where}`;
    const g = grouped.get(key) ?? { count: 0, where: new Set() };
    g.count += 1;
    g.where.add(`${a.etape}/${a.scenario}`);
    grouped.set(key, g);
}

const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
let md = `# Recette filmée EduPilot — ${date}\n\n`;
md += "Parcours complet depuis une base vide, exclusivement par l'interface, rôle par rôle. Ouvrir **index.html** pour regarder les vidéos.\n\n";
md += "| Indicateur | Valeur |\n|---|---|\n";
md += `| Étapes | ${etapes.size} |\n| Scénarios | ${[...etapes.values()].reduce((n, s) => n + s.size, 0)} |\n| Vidéos | ${videos.length} |\n| Captures d'écran | ${captures} |\n`;
md += `| Actions filmées | ${actions.length} |\n| Actions réussies | ${actions.length - echecs.length} |\n| Actions en échec | ${echecs.length} |\n`;
md += `| Anomalies (erreurs console / API / écran) | ${anomalies.length} (${grouped.size} distinctes) |\n\n`;
md += "## Actions en échec\n\n";
md += echecs.length
    ? echecs
          .map((e) => `- **${e.etape} / ${e.scenario}** — ${e.acteur} — ${e.titre}\n  - ${clean(e.detail)}${e.capture ? `\n  - capture : [${e.capture}](${encodeURI(e.capture)})` : ""}`)
          .join("\n") + "\n\n"
    : "Aucune.\n\n";
md += "## Anomalies regroupées\n\n";
md += [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([k, g]) => `- ${g.count} × ${k}\n  - vu dans : ${[...g.where].slice(0, 6).join(", ")}${g.where.size > 6 ? "…" : ""}`)
    .join("\n");
md += "\n";
// Matrice des droits (étape 14) : une colonne par rôle, une ligne par page.
const droits = journal.filter((e) => e.type === "constat" && /^Droits \//.test(e.titre));
if (droits.length) {
    const roles = [...new Set(droits.map((e) => e.acteur))];
    const pages = [...new Set(droits.map((e) => e.titre.replace(/^Droits /, "")))].sort();
    const cell = (role, page) => {
        const v = droits.find((e) => e.acteur === role && e.titre === `Droits ${page}`)?.detail ?? "";
        return v === "accessible" ? "✅" : v === "refusé" ? "⛔" : v.startsWith("redirigé") ? `↪ ${v.replace("redirigé vers ", "")}` : v || "—";
    };
    let dm = "# Matrice des droits — chaque rôle × chaque page du tableau de bord\n\n✅ accessible · ⛔ accès refusé affiché · ↪ redirection · module désactivé / HTTP : tel quel\n\n";
    dm += `| Page | ${roles.join(" | ")} |\n|---|${roles.map(() => "---").join("|")}|\n`;
    for (const pg of pages) dm += `| \`${pg}\` | ${roles.map((r) => cell(r, pg)).join(" | ")} |\n`;
    fs.writeFileSync(path.join(OUT, "DROITS.md"), dm);
}
fs.writeFileSync(path.join(OUT, "RAPPORT.md"), md);

// ─── index.html ──────────────────────────────────────────────────────────────
const badge = (e) =>
    e.type === "action"
        ? `<span class="b ${e.ok ? "ok" : "ko"}">${e.ok ? "✓" : "✗"}</span>`
        : e.type === "anomalie"
          ? '<span class="b warn">!</span>'
          : '<span class="b info">i</span>';

let nav = "";
let body = "";
for (const [etape, scenarios] of etapes) {
    const all = [...scenarios.values()].flatMap((s) => s.entries);
    const eEchecs = all.filter((e) => e.type === "action" && e.ok === false).length;
    nav += `<li><a href="#${etape}">${esc(etape.slice(0, 2))} · ${esc(human(etape))}</a>${eEchecs ? ` <span class="b ko">${eEchecs}</span>` : ""}</li>`;
    body += `<section id="${etape}"><h2>${esc(etape.slice(0, 2))} · ${esc(human(etape))}</h2>`;
    for (const [sc, data] of scenarios) {
        const ko = data.entries.filter((e) => e.type === "action" && e.ok === false).length;
        const ok = data.entries.filter((e) => e.type === "action" && e.ok).length;
        body += `<article><h3>${esc(human(sc))} <small>${ok} ✓ · ${ko} ✗</small></h3><div class="vids">`;
        for (const v of data.videos) {
            body += `<figure><video controls preload="none" src="${encodeURI(v)}"></video><figcaption>${esc(path.basename(v).replace(/\.(mp4|webm)$/, ""))}</figcaption></figure>`;
        }
        const shots = data.entries.filter((e) => e.type === "action" && e.ecran);
        if (shots.length) {
            body += `</div><div class="album">`;
            for (const e of shots) {
                body += `<a class="shot${e.ok ? "" : " bad"}" href="${encodeURI(e.ecran)}" target="_blank"><img loading="lazy" src="${encodeURI(e.ecran)}" alt=""><span>${e.ok ? "✓" : "✗"} ${esc(e.titre)}</span></a>`;
            }
        }
        body += `</div><details${ko ? " open" : ""}><summary>Journal (${data.entries.length})</summary><ul class="log">`;
        for (const e of data.entries) {
            body += `<li>${badge(e)} <b>${esc(e.acteur)}</b> — ${esc(e.titre)}`;
            if (e.detail) body += `<div class="d">${esc(clean(e.detail))}</div>`;
            if (e.capture) body += `<div><a href="${encodeURI(e.capture)}">capture de l'échec</a></div>`;
            body += "</li>";
        }
        body += "</ul></details></article>";
    }
    body += "</section>";
}

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recette EduPilot</title><style>
:root{--bg:#f7f8fa;--card:#fff;--text:#111827;--muted:#6b7280;--line:#e5e7eb;--ok:#15803d;--ko:#b91c1c;--warn:#b45309;--info:#1d4ed8}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--text:#e5e7eb;--muted:#9ca3af;--line:#2a2f3a}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--text)}
header{padding:24px 16px;border-bottom:1px solid var(--line);background:var(--card)}h1{margin:0 0 6px;font-size:22px}
.kpi{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.kpi div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 12px}
.wrap{display:grid;grid-template-columns:260px 1fr;gap:24px;max-width:1400px;margin:0 auto;padding:16px}
nav ul{list-style:none;padding:0;margin:0;position:sticky;top:12px}nav li{margin:4px 0}nav a{color:var(--text)}
section{margin-bottom:32px}h2{font-size:19px;border-bottom:1px solid var(--line);padding-bottom:6px}
article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:12px 0}h3{margin:0 0 10px;font-size:16px}h3 small{color:var(--muted);font-weight:500}
.vids{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}figure{margin:0}video{width:100%;border-radius:8px;background:#000}figcaption{font-size:13px;color:var(--muted)}
.album{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:12px}.shot{display:block;border:1px solid var(--line);border-radius:8px;overflow:hidden;color:var(--text);text-decoration:none;font-size:12px}.shot img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;object-position:top}.shot span{display:block;padding:6px 8px}.shot.bad{border-color:var(--ko);outline:2px solid var(--ko)}
.log{list-style:none;padding:0}.log li{padding:6px 0;border-bottom:1px solid var(--line)}.d{color:var(--muted);font-size:13px;word-break:break-word}
.b{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:10px;font-size:12px;font-weight:700;color:#fff;padding:0 6px}.ok{background:var(--ok)}.ko{background:var(--ko)}.warn{background:var(--warn)}.info{background:var(--info)}
@media (max-width:800px){.wrap{grid-template-columns:1fr}nav ul{position:static}}
</style></head><body><header><h1>Recette filmée EduPilot</h1><div>Cycle de vie complet depuis une base vide, par l'interface, tous rôles et configurations. Détail des échecs : RAPPORT.md.</div>
<div class="kpi"><div>${etapes.size} étapes</div><div>${videos.length} vidéos</div><div>${captures} captures</div><div>${actions.length} actions</div><div><span class="b ok">✓</span> ${actions.length - echecs.length}</div><div><span class="b ko">✗</span> ${echecs.length}</div><div><span class="b warn">!</span> ${anomalies.length} anomalies</div></div></header>
<div class="wrap"><nav><ul>${nav}</ul></nav><main>${body}</main></div></body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log(`rapport : ${etapes.size} étapes, ${videos.length} vidéos, ${actions.length} actions (${echecs.length} échecs), ${anomalies.length} anomalies`);
