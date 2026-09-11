import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * H3 — le préchargement serveur complète X-Forwarded-For avec l'adresse de la
 * socket (Next ne le fait que si l'en-tête est absent) et signe la chaîne avec
 * un jeton de processus qu'un client ne peut pas imposer.
 */
const require = createRequire(import.meta.url);
const PRELOAD = path.resolve(__dirname, "../../../scripts/server/client-ip-preload.cjs");

let server: http.Server;
let port: number;

beforeAll(async () => {
  require(PRELOAD);
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(req.headers));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function get(headers: Record<string, string>): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path: "/", headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(JSON.parse(body)));
      })
      .on("error", reject);
  });
}

describe("client-ip-preload", () => {
  it("expose un jeton de processus aléatoire", () => {
    expect(process.env.EDUPILOT_PEER_TOKEN).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ajoute l'adresse de la socket quand le client n'envoie pas de XFF", async () => {
    const seen = await get({});
    expect(seen["x-forwarded-for"]).toBe("127.0.0.1");
    expect(seen["x-edupilot-peer-token"]).toBe(process.env.EDUPILOT_PEER_TOKEN);
  });

  it("ajoute l'adresse de la socket à la fin d'un XFF fourni par le client", async () => {
    const seen = await get({ "x-forwarded-for": "6.6.6.6" });
    expect(seen["x-forwarded-for"]).toBe("6.6.6.6, 127.0.0.1");
  });

  it("écrase un jeton fourni par le client", async () => {
    const seen = await get({ "x-edupilot-peer-token": "forged" });
    expect(seen["x-edupilot-peer-token"]).toBe(process.env.EDUPILOT_PEER_TOKEN);
  });
});
