/**
 * Couverture de POST /api/ai/v2/chat (assistant local) : validation du corps,
 * limite de débit, identité transmise au moteur, contexte de conversation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "../../api/test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/ai/assistant/engine", () => ({ answerQuestion: vi.fn() }));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return { ...actual, checkRateLimit: vi.fn() };
});

import { answerQuestion } from "@/lib/ai/assistant/engine";
import { checkRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/ai/v2/chat/route";

const url = "http://localhost/api/ai/v2/chat";
const post = (body: unknown) => POST(makeRequest(url, { method: "POST", body }));
const answer = {
  text: "**3 élèves à suivre**",
  blocks: [],
  links: [],
  suggestions: [],
  context: { intent: "risk.list" },
  meta: { intent: "risk.list", understanding: 1, elapsedMs: 4, sources: ["analyses de période"] },
};

beforeEach(() => {
  vi.clearAllMocks();
  const session = makeSession("TEACHER", { schoolId: FIXTURES.schoolA, id: "u-t" });
  Object.assign(session.user, { name: "Awa Dossou" });
  vi.mocked(auth).mockResolvedValue(session as never);
  vi.mocked(checkRateLimit).mockResolvedValue({ success: true, reset: new Date() } as never);
  vi.mocked(answerQuestion).mockResolvedValue(answer as never);
});

describe("POST /api/ai/v2/chat", () => {
  it("exige une session (401)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    expect((await post({ message: "x" })).status).toBe(401);
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it("refuse un message vide ou trop long (400)", async () => {
    expect((await post({ message: "   " })).status).toBe(400);
    expect((await post({ message: "a".repeat(501) })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it("refuse un contexte mal formé (intention inconnue)", async () => {
    expect((await post({ message: "Bonjour", context: { intent: "drop-database" } })).status).toBe(400);
  });

  it("transmet l'identité de la session (jamais celle du corps) et le contexte", async () => {
    const res = await post({ message: "  Élèves à risque  ", context: { intent: "risk.list", classId: "c-1" }, userId: "pirate" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(answer);
    expect(answerQuestion).toHaveBeenCalledWith(
      "Élèves à risque",
      { id: "u-t", role: "TEACHER", schoolId: FIXTURES.schoolA, firstName: "Awa" },
      { intent: "risk.list", classId: "c-1" },
    );
  });

  it("applique la limite stricte (429 + Retry-After)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, reset: new Date(Date.now() + 9000) } as never);
    const res = await post({ message: "Bonjour" });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(answerQuestion).not.toHaveBeenCalled();
  });
});
