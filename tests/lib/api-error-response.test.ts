import { describe, it, expect } from "vitest";
import {
  apiErrorResponse,
  validationErrorResponse,
  internalErrorResponse,
  getOrCreateRequestId,
} from "@/lib/api/error-response";

describe("API error response helpers", () => {
  describe("apiErrorResponse", () => {
    it("returns JSON with error and code", async () => {
      const res = apiErrorResponse(400, {
        error: "Données invalides",
        code: "VALIDATION_ERROR",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Données invalides");
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("includes requestId when provided", async () => {
      const res = apiErrorResponse(
        500,
        { error: "Erreur", code: "INTERNAL_ERROR", requestId: "req-123" },
        { requestId: "req-123" }
      );
      expect(res.headers.get("X-Request-Id")).toBe("req-123");
      const body = await res.json();
      expect(body.requestId).toBe("req-123");
    });

    it("includes details when provided", async () => {
      const res = apiErrorResponse(400, {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "email", message: "Invalid" }],
      });
      const body = await res.json();
      expect(body.details).toEqual([{ field: "email", message: "Invalid" }]);
    });
  });

  describe("validationErrorResponse", () => {
    it("returns 400 with VALIDATION_ERROR code", async () => {
      const details = [{ path: ["email"] as string[] }];
      const res = validationErrorResponse("Email invalide", details);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Email invalide");
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.details).toEqual(details);
    });
  });

  describe("internalErrorResponse", () => {
    it("returns 500 with generic message", async () => {
      const res = internalErrorResponse();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("erreur interne");
      expect(body.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("getOrCreateRequestId", () => {
    it("returns string or undefined (UUID when crypto.randomUUID available)", () => {
      const id = getOrCreateRequestId();
      if (id !== undefined) {
        expect(typeof id).toBe("string");
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    it("returns X-Request-Id from request when provided", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Request-Id": "custom-req-456" },
      });
      const id = getOrCreateRequestId(request);
      expect(id).toBe("custom-req-456");
    });
  });
});
