/**
 * Seaux à jetons (token bucket) partagés par Redis.
 *
 * Un seau contient au plus `capacity` jetons et se remplit en continu de
 * `refillPerMs` jetons par milliseconde. Une requête prend un jeton ; seau vide
 * ⇒ refus, avec le délai exact avant le prochain jeton (en-tête Retry-After).
 * Contrairement à une fenêtre fixe, une rafale en début de minute n'est pas
 * suivie d'un blocage net : le débit revient progressivement.
 *
 * Plusieurs seaux sont vérifiés ensemble (compte ET adresse IP) en un seul
 * aller-retour atomique : si l'un est vide, AUCUN n'est débité — un enseignant
 * bloqué par son quota personnel ne consomme pas celui de son école.
 *
 * Stockage :
 *  - `REDIS_URL` configuré et joignable → script Lua (horloge du serveur Redis,
 *    donc identique pour tous les pods) ;
 *  - sinon → même algorithme en mémoire (exact pour un seul processus).
 */
import type Redis from "ioredis";
import { getTcpRedis, tcpRedisCircuit } from "@/lib/redis/tcp";

export interface BucketSpec {
    key: string;
    capacity: number;
    refillPerMs: number;
}

export interface ConsumeResult {
    allowed: boolean;
    /** Jetons restants dans le seau le plus bas (après débit). */
    remaining: number;
    /** Délai avant qu'une nouvelle requête passe, 0 si autorisée. */
    retryAfterMs: number;
    /** Index du premier seau vide dans la liste fournie, -1 si autorisée. */
    deniedIndex: number;
}

export interface TakeResult {
    /** Jetons accordés (0 à `wanted`). */
    granted: number;
    /** Délai avant le prochain jeton, 0 si au moins un a été accordé. */
    retryAfterMs: number;
}

/** Seau de `perMinute` jetons rempli en une minute : la rafale maximale vaut le quota. */
export function perMinute(key: string, perMinuteCount: number): BucketSpec {
    return { key, capacity: perMinuteCount, refillPerMs: perMinuteCount / 60_000 };
}

// ─── Algorithme (partagé par la mémoire, miroir exact du Lua) ─────────────────

interface BucketState {
    tokens: number;
    ts: number;
}

function refill(state: BucketState | undefined, spec: BucketSpec, now: number): number {
    if (!state) return spec.capacity;
    return Math.min(spec.capacity, state.tokens + Math.max(0, now - state.ts) * spec.refillPerMs);
}

/** Seaux en mémoire ; horloge injectable pour les tests. */
export class MemoryTokenBuckets {
    private readonly buckets = new Map<string, BucketState>();

    constructor(private readonly now: () => number = Date.now) {}

    consume(specs: readonly BucketSpec[], cost = 1): ConsumeResult {
        const now = this.now();
        const levels = specs.map((spec) => refill(this.buckets.get(spec.key), spec, now));
        let deniedIndex = -1;
        let retryAfterMs = 0;
        levels.forEach((tokens, i) => {
            if (tokens >= cost) return;
            if (deniedIndex === -1) deniedIndex = i;
            retryAfterMs = Math.max(retryAfterMs, Math.ceil((cost - tokens) / specs[i].refillPerMs));
        });
        const allowed = deniedIndex === -1;
        let remaining = Infinity;
        specs.forEach((spec, i) => {
            const tokens = allowed ? levels[i] - cost : levels[i];
            this.buckets.set(spec.key, { tokens, ts: now });
            remaining = Math.min(remaining, Math.floor(tokens));
        });
        this.sweep(now);
        return { allowed, remaining: remaining === Infinity ? 0 : remaining, retryAfterMs, deniedIndex };
    }

    takeUpTo(spec: BucketSpec, wanted: number): TakeResult {
        const now = this.now();
        const tokens = refill(this.buckets.get(spec.key), spec, now);
        const granted = Math.max(0, Math.min(wanted, Math.floor(tokens)));
        const left = tokens - granted;
        this.buckets.set(spec.key, { tokens: left, ts: now });
        return { granted, retryAfterMs: granted > 0 ? 0 : Math.ceil((1 - left) / spec.refillPerMs) };
    }

    private lastSweep = 0;

    /** Oublie les seaux pleins depuis longtemps : la mémoire ne grossit pas avec le nombre de visiteurs. */
    private sweep(now: number): void {
        if (now - this.lastSweep < 60_000) return;
        this.lastSweep = now;
        for (const [key, state] of this.buckets) {
            if (now - state.ts > 10 * 60_000) this.buckets.delete(key);
        }
    }
}

// ─── Scripts Redis ────────────────────────────────────────────────────────────

/** Horloge commune à tous les pods : celle du serveur Redis, en millisecondes. */
const LUA_NOW = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
`;

const LUA_REFILL = `
local function level(key, cap, rate, now)
  local state = redis.call('HMGET', key, 'tokens', 'ts')
  local tokens = tonumber(state[1])
  local ts = tonumber(state[2])
  if tokens == nil or ts == nil then return cap end
  return math.min(cap, tokens + math.max(0, now - ts) * rate)
end
local function save(key, tokens, cap, rate, now)
  redis.call('HSET', key, 'tokens', tostring(tokens), 'ts', tostring(now))
  redis.call('PEXPIRE', key, math.ceil(cap / rate) + 1000)
end
`;

/** KEYS = seaux ; ARGV = coût, puis (capacité, débit/ms) par seau. Retour : {refusé (index 1-based ou 0), restants, attente}. */
export const CONSUME_LUA = `${LUA_NOW}${LUA_REFILL}
local cost = tonumber(ARGV[1])
local levels = {}
local denied = 0
local retry = 0
for i = 1, #KEYS do
  local cap = tonumber(ARGV[i * 2])
  local rate = tonumber(ARGV[i * 2 + 1])
  local tokens = level(KEYS[i], cap, rate, now)
  levels[i] = tokens
  if tokens < cost then
    if denied == 0 then denied = i end
    local wait = math.ceil((cost - tokens) / rate)
    if wait > retry then retry = wait end
  end
end
local remaining = -1
for i = 1, #KEYS do
  local cap = tonumber(ARGV[i * 2])
  local rate = tonumber(ARGV[i * 2 + 1])
  local tokens = levels[i]
  if denied == 0 then tokens = tokens - cost end
  save(KEYS[i], tokens, cap, rate, now)
  local floored = math.floor(tokens)
  if remaining < 0 or floored < remaining then remaining = floored end
end
return {denied, remaining, retry}
`;

/** KEYS[1] = seau ; ARGV = capacité, débit/ms, jetons voulus. Retour : {accordés, attente}. */
export const TAKE_UP_TO_LUA = `${LUA_NOW}${LUA_REFILL}
local cap = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local wanted = tonumber(ARGV[3])
local tokens = level(KEYS[1], cap, rate, now)
local granted = math.max(0, math.min(wanted, math.floor(tokens)))
local left = tokens - granted
save(KEYS[1], left, cap, rate, now)
local retry = 0
if granted == 0 then retry = math.ceil((1 - left) / rate) end
return {granted, retry}
`;

type ScriptedRedis = Redis & {
    edupilotConsumeTokens(numKeys: number, ...args: (string | number)[]): Promise<[number, number, number]>;
    edupilotTakeTokens(key: string, ...args: (string | number)[]): Promise<[number, number]>;
};

const scripted = new WeakSet<Redis>();

/** Déclare les scripts une fois par client : ioredis les appelle ensuite par EVALSHA. */
function withScripts(client: Redis): ScriptedRedis {
    if (!scripted.has(client)) {
        client.defineCommand("edupilotConsumeTokens", { lua: CONSUME_LUA });
        client.defineCommand("edupilotTakeTokens", { numberOfKeys: 1, lua: TAKE_UP_TO_LUA });
        scripted.add(client);
    }
    return client as ScriptedRedis;
}

export async function consumeRedis(client: Redis, specs: readonly BucketSpec[], cost = 1): Promise<ConsumeResult> {
    const args = specs.flatMap((spec) => [spec.capacity, spec.refillPerMs]);
    const [denied, remaining, retry] = await withScripts(client).edupilotConsumeTokens(
        specs.length,
        ...specs.map((spec) => spec.key),
        cost,
        ...args,
    );
    return { allowed: denied === 0, remaining: Math.max(0, remaining), retryAfterMs: retry, deniedIndex: denied - 1 };
}

export async function takeRedis(client: Redis, spec: BucketSpec, wanted: number): Promise<TakeResult> {
    const [granted, retry] = await withScripts(client).edupilotTakeTokens(spec.key, spec.capacity, spec.refillPerMs, wanted);
    return { granted, retryAfterMs: retry };
}

// ─── API ──────────────────────────────────────────────────────────────────────

const globalForBuckets = globalThis as unknown as { __edupilotMemoryBuckets?: MemoryTokenBuckets };
const memoryBuckets = (globalForBuckets.__edupilotMemoryBuckets ??= new MemoryTokenBuckets());

/** Débite `cost` jetons de chaque seau, ou d'aucun si l'un est vide. */
export async function consumeTokens(specs: readonly BucketSpec[], cost = 1): Promise<ConsumeResult> {
    const client = getTcpRedis();
    if (!client) return memoryBuckets.consume(specs, cost);
    return tcpRedisCircuit.run(
        () => consumeRedis(client, specs, cost),
        () => memoryBuckets.consume(specs, cost),
    );
}

/** Prend jusqu'à `wanted` jetons (autant que le seau en contient). */
export async function takeTokens(spec: BucketSpec, wanted: number): Promise<TakeResult> {
    const client = getTcpRedis();
    if (!client) return memoryBuckets.takeUpTo(spec, wanted);
    return tcpRedisCircuit.run(
        () => takeRedis(client, spec, wanted),
        () => memoryBuckets.takeUpTo(spec, wanted),
    );
}
