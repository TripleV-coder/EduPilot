import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    communicationTemplate: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/communication/templates/route";
import { PATCH } from "@/app/api/communication/templates/[id]/route";

const schoolId = FIXTURES.schoolA;
const templateId = cuid("tplbulletin01");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/communication/templates", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/communication/templates") as never);
    expect(res.status).toBe(401);
  });

  it("seed puis liste les modèles de l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId }));
    vi.mocked(prisma.communicationTemplate.count).mockResolvedValue(0);
    vi.mocked(prisma.communicationTemplate.createMany).mockResolvedValue({ count: 12 });
    vi.mocked(prisma.communicationTemplate.findMany).mockResolvedValue([
      {
        id: templateId,
        schoolId,
        name: "Bulletin disponible",
        language: "fr",
        subject: "Pédagogie||Auto conseil",
        content: "<!--slug:bulletin-ready-->\nBonjour {parent.prenom}",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/communication/templates") as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.communicationTemplate.createMany).toHaveBeenCalledOnce();
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0]).toMatchObject({
      id: templateId,
      slug: "bulletin-ready",
      name: "Bulletin disponible",
      category: "Pédagogie",
      autoTrigger: "Auto conseil",
      body: "Bonjour {parent.prenom}",
    });
  });
});

describe("POST /api/communication/templates", () => {
  it("crée un modèle pour l'école active", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId }));
    const created = {
      id: cuid("tplnewmodel0001"),
      schoolId,
      name: "Nouveau modèle",
      language: "fr",
      subject: "Administration",
      content: "<!--slug:nouveau-modele-->\nBonjour",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.communicationTemplate.create).mockResolvedValue(created as never);

    const res = await POST(
      makeRequest("http://localhost/api/communication/templates", {
        method: "POST",
        body: {
          name: "Nouveau modèle",
          category: "Administration",
          body: "Bonjour",
        },
      }) as never
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.template.name).toBe("Nouveau modèle");
    expect(json.template.category).toBe("Administration");
  });
});

describe("PATCH /api/communication/templates/[id]", () => {
  it("met à jour le corps d'un modèle tenant-scopé", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId }));
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue({
      id: templateId,
      schoolId,
      name: "Bulletin disponible",
      language: "fr",
      subject: "Pédagogie",
      content: "<!--slug:bulletin-ready-->\nAncien",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.communicationTemplate.update).mockResolvedValue({
      id: templateId,
      schoolId,
      name: "Bulletin disponible",
      language: "fr",
      subject: "Pédagogie",
      content: "<!--slug:bulletin-ready-->\nNouveau corps",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await PATCH(
      makeRequest(`http://localhost/api/communication/templates/${templateId}`, {
        method: "PATCH",
        body: { body: "Nouveau corps" },
      }) as never,
      { params: Promise.resolve({ id: templateId }) } as never
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.template.body).toBe("Nouveau corps");
  });

  it("retourne 404 si le modèle n'appartient pas à l'école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId }));
    vi.mocked(prisma.communicationTemplate.findFirst).mockResolvedValue(null);

    const res = await PATCH(
      makeRequest(`http://localhost/api/communication/templates/${templateId}`, {
        method: "PATCH",
        body: { body: "x".repeat(10) },
      }) as never,
      { params: Promise.resolve({ id: templateId }) } as never
    );

    expect(res.status).toBe(404);
  });
});
