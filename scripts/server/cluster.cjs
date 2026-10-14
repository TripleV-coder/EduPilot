"use strict";
/**
 * Lanceur multi-processus du serveur standalone (analyse de capacité du
 * 2026-10-01, G1).
 *
 *   node scripts/server/cluster.cjs .next/standalone/server.js     (dépôt)
 *   node cluster.cjs server.js                                     (image Docker)
 *
 * Un processus Node n'exécute le code applicatif que sur UN cœur : mesuré, le
 * thread principal sature à 100 % vers 60–120 requêtes/s pendant que le reste
 * de la machine dort. Ce lanceur démarre `WEB_CONCURRENCY` processus qui
 * partagent le même port (module `cluster` de Node) :
 *
 *   WEB_CONCURRENCY=1 (défaut)  → un seul processus, comportement historique ;
 *   WEB_CONCURRENCY=4           → 4 processus ;
 *   WEB_CONCURRENCY=max         → un processus par cœur disponible.
 *
 * Au-delà d'un processus, les limites de débit, les compteurs d'échecs de
 * connexion et le coupe-circuit DOIVENT être partagés : `REDIS_URL` est
 * obligatoire, sinon chaque processus aurait ses propres compteurs et les
 * limites seraient multipliées par le nombre de processus (une protection
 * contre la force brute divisée d'autant). Le lanceur refuse alors de démarrer.
 *
 * Chaque processus charge les deux préchargements (adresse client fiable H3,
 * arrêt propre Lot 7). Le processus principal ne sert aucune requête : il
 * relaie SIGTERM/SIGINT aux processus, attend leur arrêt propre, relance un
 * processus tombé (avec un délai croissant) et quitte quand tous sont arrêtés.
 */
const cluster = require("node:cluster");
const os = require("node:os");
const path = require("node:path");

const PRELOADS = ["client-ip-preload.cjs", "graceful-shutdown.cjs"].map((file) => path.join(__dirname, file));
const serverEntry = path.resolve(process.argv[2] || "server.js");

function log(message, extra) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", message: `[cluster] ${message}`, ...extra }));
}

function workerCount() {
    const raw = (process.env.WEB_CONCURRENCY || "1").trim().toLowerCase();
    if (raw === "max") return Math.max(1, os.availableParallelism());
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 ? n : 1;
}

function hasSharedStore() {
    return Boolean(
        process.env.REDIS_URL || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    );
}

const count = workerCount();

if (count === 1) {
    // Processus unique : préchargements puis serveur, dans ce processus.
    for (const preload of PRELOADS) require(preload);
    require(serverEntry);
} else if (cluster.isPrimary) {
    if (!hasSharedStore() && process.env.CLUSTER_ALLOW_LOCAL_LIMITS !== "true") {
        console.error(
            `[cluster] REFUS : WEB_CONCURRENCY=${count} sans REDIS_URL. Les limites de débit et les compteurs ` +
                "d'échecs de connexion seraient propres à chaque processus (protections multipliées par " +
                `${count}). Configurer REDIS_URL, ou WEB_CONCURRENCY=1.`,
        );
        process.exit(1);
    }

    cluster.setupPrimary({
        exec: serverEntry,
        execArgv: [...process.execArgv, ...PRELOADS.flatMap((preload) => ["--require", preload])],
    });

    let stopping = false;
    let crashStreak = 0;

    function fork() {
        const worker = cluster.fork();
        worker.startedAt = Date.now();
        return worker;
    }

    log(`démarrage de ${count} processus`, { workers: count, entry: serverEntry });
    for (let i = 0; i < count; i++) fork();

    cluster.on("exit", (worker, code, signal) => {
        if (stopping) {
            if (Object.keys(cluster.workers).length === 0) {
                log("tous les processus sont arrêtés");
                process.exit(0);
            }
            return;
        }
        // Relance avec un délai croissant si le processus tombe en boucle.
        const livedMs = Date.now() - (worker.startedAt || 0);
        crashStreak = livedMs < 10_000 ? crashStreak + 1 : 0;
        const delay = Math.min(30_000, 100 * 2 ** crashStreak);
        log("processus arrêté, relance", { pid: worker.process.pid, code, signal, delayMs: delay });
        setTimeout(() => {
            if (!stopping) fork();
        }, delay);
    });

    for (const sig of ["SIGTERM", "SIGINT"]) {
        process.on(sig, () => {
            if (stopping) return;
            stopping = true;
            log(`arrêt demandé (${sig}), relayé aux processus`);
            for (const worker of Object.values(cluster.workers)) worker.process.kill("SIGTERM");
            // Filet : l'arrêt propre d'un processus dure 25 s au plus (20 + 5).
            setTimeout(() => process.exit(0), 30_000).unref();
        });
    }
}
