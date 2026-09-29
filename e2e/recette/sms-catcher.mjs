#!/usr/bin/env node
/**
 * Faux fournisseur SMS pour la recette filmée : reçoit les envois de
 * l'application (SMS_WEBHOOK_URL=http://127.0.0.1:8027/sms) et les affiche sur
 * http://127.0.0.1:8027/ pour qu'on les voie arriver dans les vidéos.
 *
 *   node e2e/recette/sms-catcher.mjs [port]
 */
import { createServer } from "node:http";

const port = Number(process.argv[2] || 8027);
const received = [];

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

createServer((req, res) => {
    if (req.method === "POST" && req.url === "/sms") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            let payload = {};
            try {
                payload = JSON.parse(body);
            } catch {
                payload = { raw: body };
            }
            const entry = { id: `sms-${received.length + 1}`, at: new Date().toISOString(), ...payload };
            received.push(entry);
            console.log(`[sms] ${entry.phoneNumber} (${entry.type}) : ${entry.message}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ messageId: entry.id, queued: false }));
        });
        return;
    }
    if (req.method === "GET" && req.url === "/api") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(received));
        return;
    }
    const rows = received
        .slice()
        .reverse()
        .map(
            (s) =>
                `<tr><td>${escape(new Date(s.at).toLocaleString("fr-FR"))}</td><td>${escape(s.phoneNumber)}</td><td>${escape(s.type)}</td><td>${escape(s.message)}</td></tr>`,
        )
        .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>SMS reçus</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1f2937}h1{font-size:22px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:14px;vertical-align:top}th{background:#f3f4f6}</style></head>
<body><h1>Passerelle SMS de test — ${received.length} SMS reçu(s)</h1>
<table><thead><tr><th>Reçu le</th><th>Destinataire</th><th>Type</th><th>Message</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Aucun SMS reçu.</td></tr>'}</tbody></table></body></html>`);
}).listen(port, "127.0.0.1", () => console.log(`[sms] passerelle de test sur http://127.0.0.1:${port}/`));
