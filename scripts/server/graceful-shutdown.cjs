"use strict";
/**
 * Arrêt propre du serveur (Lot 7).
 *
 *   node --require ./scripts/server/graceful-shutdown.cjs .next/standalone/server.js
 *
 * Coupures de courant, `docker stop`, `pm2 reload`, redémarrage de la machine :
 * le signal SIGTERM ne doit jamais couper une saisie de notes ou un paiement en
 * cours d'écriture. La séquence est :
 *
 *   1. on cesse d'accepter de NOUVELLES connexions (`server.close()`) ;
 *   2. on attend la fin des requêtes DÉJÀ en cours (plafond configurable) ;
 *   3. on exécute les fermetures déclarées par l'application (Prisma, Redis) ;
 *   4. on quitte.
 *
 * Ce module est chargé AVANT Next, en CommonJS : son écouteur de signal est
 * donc enregistré en premier. `NEXT_MANUAL_SIG_HANDLE` empêche Next
 * d'enregistrer le sien, qui appelle `process.exit(143)` sans attendre — c'est
 * lui qui coupait les requêtes en vol.
 *
 * L'application déclare ce qu'elle veut fermer via `globalThis.__edupilotShutdown`
 * (voir src/lib/system/shutdown.ts) : le préchargement décide QUAND, l'application
 * décide QUOI.
 */
const http = require("node:http");
const https = require("node:https");

// Next ne doit pas quitter le processus de son côté (cf. en-tête).
process.env.NEXT_MANUAL_SIG_HANDLE = "1";

/** Délai maximal accordé aux requêtes en cours (ms). */
const DRAIN_TIMEOUT_MS = Number(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS || 20000);
/** Délai maximal accordé aux fermetures de l'application (ms). */
const TASK_TIMEOUT_MS = Number(process.env.SHUTDOWN_TASK_TIMEOUT_MS || 5000);

const state = {
    shuttingDown: false,
    inflight: 0,
    /** Fermetures déclarées par l'application : () => Promise<void> */
    tasks: [],
};
globalThis.__edupilotShutdown = state;

const servers = new Set();

function trackServer(proto) {
    const originalListen = proto.listen;
    proto.listen = function listenTracked(...args) {
        servers.add(this);
        return originalListen.apply(this, args);
    };

    const originalEmit = proto.emit;
    proto.emit = function emitTracked(event, req, res, ...rest) {
        if (event === "request" && res && typeof res.once === "function") {
            state.inflight += 1;
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                state.inflight -= 1;
            };
            res.once("finish", finish);
            res.once("close", finish);
        }
        return originalEmit.call(this, event, req, res, ...rest);
    };
}

trackServer(http.Server.prototype);
trackServer(https.Server.prototype);

function log(message, extra) {
    // Même forme que le journal applicatif (JSON par ligne).
    process.stdout.write(
        `${JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info",
            message,
            context: { app: "edupilot", module: "server/shutdown", ...extra },
        })}\n`,
    );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function drain() {
    const deadline = Date.now() + DRAIN_TIMEOUT_MS;
    while (state.inflight > 0 && Date.now() < deadline) {
        await sleep(50);
    }
    return state.inflight;
}

async function runTasks() {
    const results = await Promise.allSettled(
        state.tasks.map((task) =>
            Promise.race([task(), sleep(TASK_TIMEOUT_MS).then(() => { throw new Error("délai dépassé"); })]),
        ),
    );
    return results.filter((r) => r.status === "rejected").length;
}

async function shutdown(signal) {
    if (state.shuttingDown) return;
    state.shuttingDown = true;
    const startedAt = Date.now();
    log(`Arrêt demandé (${signal}) : plus aucune nouvelle connexion acceptée.`, { inflight: state.inflight });

    for (const server of servers) {
        try {
            server.close();
        } catch {
            // serveur déjà fermé
        }
    }

    const remaining = await drain();
    if (remaining > 0) {
        log("Requêtes encore en cours après le délai : arrêt quand même.", { remaining, drainTimeoutMs: DRAIN_TIMEOUT_MS });
    }

    const failed = await runTasks();
    log("Arrêt terminé.", { durationMs: Date.now() - startedAt, tasks: state.tasks.length, failedTasks: failed });

    process.exit(0);
}

for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
        shutdown(signal).catch(() => process.exit(1));
    });
}
