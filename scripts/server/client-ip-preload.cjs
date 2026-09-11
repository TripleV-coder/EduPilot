"use strict";
/**
 * Préchargement serveur — adresse client fiable (audit H3).
 *
 *   node --require ./scripts/server/client-ip-preload.cjs .next/standalone/server.js
 *
 * Next ne renseigne X-Forwarded-For avec l'adresse de la socket que si le
 * client n'a pas envoyé cet en-tête. Ce module, chargé avant Next, complète la
 * chaîne à chaque requête HTTP(S) entrante :
 *   - ajoute l'adresse de la socket (le pair réel) à la FIN de X-Forwarded-For ;
 *   - pose `x-edupilot-peer-token` = jeton aléatoire du processus, en écrasant
 *     toute valeur envoyée par le client.
 * `src/lib/security/client-ip.ts` ne croit la chaîne que si ce jeton est présent
 * et correspond à `process.env.EDUPILOT_PEER_TOKEN`.
 */
const http = require("node:http");
const https = require("node:https");
const { randomBytes } = require("node:crypto");

const PEER_TOKEN_HEADER = "x-edupilot-peer-token";
const token = randomBytes(32).toString("hex");
process.env.EDUPILOT_PEER_TOKEN = token;

function install(proto) {
  const originalEmit = proto.emit;
  proto.emit = function emitWithPeerAddress(event, req, ...rest) {
    if (event === "request" && req && req.headers) {
      const chain = [];
      const forwarded = req.headers["x-forwarded-for"];
      if (typeof forwarded === "string" && forwarded.trim()) chain.push(forwarded.trim());
      const peer = req.socket && req.socket.remoteAddress;
      if (peer) chain.push(peer);

      if (chain.length > 0) req.headers["x-forwarded-for"] = chain.join(", ");
      else delete req.headers["x-forwarded-for"];
      req.headers[PEER_TOKEN_HEADER] = token;
    }
    return originalEmit.call(this, event, req, ...rest);
  };
}

install(http.Server.prototype);
install(https.Server.prototype);
