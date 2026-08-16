import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportToCSV, ExportData } from "@/lib/utils/export";

/**
 * exportToCSV uses browser APIs (Blob, URL, document) — we stub them.
 */

describe("utils/export.exportToCSV", () => {
  const originalDocument = globalThis.document;
  const originalURL = globalThis.URL;
  const originalBlob = globalThis.Blob;

  interface MockLink {
    setAttribute: ReturnType<typeof vi.fn>;
    style: Record<string, unknown>;
    click: ReturnType<typeof vi.fn>;
  }

  let appendedLink: MockLink | undefined;

  beforeEach(() => {
    appendedLink = {
      setAttribute: vi.fn(),
      style: {},
      click: vi.fn(),
    };

    globalThis.document = {
      createElement: vi.fn(() => appendedLink),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    } as unknown as typeof globalThis.document;
    globalThis.URL = {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    } as unknown as typeof globalThis.URL;
    globalThis.Blob = vi.fn().mockImplementation(function (
      this: { parts: unknown[]; options: unknown },
      parts: unknown,
      options: unknown
    ) {
      this.parts = parts;
      this.options = options;
    }) as unknown as typeof globalThis.Blob;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.URL = originalURL;
    globalThis.Blob = originalBlob;
  });

  it("creates a download link with proper filename", () => {
    const data: ExportData = {
      title: "rapport_finance",
      headers: ["Date", "Montant"],
      rows: [
        ["2026-05-01", 1000],
        ["2026-05-02", 2500],
      ],
      timestamp: new Date("2026-05-16T00:00:00Z"),
    };

    exportToCSV(data);

    expect(appendedLink.click).toHaveBeenCalled();
    expect(appendedLink.setAttribute).toHaveBeenCalledWith(
      "download",
      "rapport_finance_2026-05-16.csv"
    );
  });

  it("appends and removes the link from DOM", () => {
    exportToCSV({ title: "x", headers: ["A"], rows: [["1"]] });
    const doc = globalThis.document as {
      body: { appendChild: ReturnType<typeof vi.fn>; removeChild: ReturnType<typeof vi.fn> };
    };
    expect(doc.body.appendChild).toHaveBeenCalled();
    expect(doc.body.removeChild).toHaveBeenCalled();
  });

  it("creates a Blob with text/csv mime type", () => {
    exportToCSV({ title: "t", headers: ["A"], rows: [["1"]] });
    const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
    expect(BlobMock).toHaveBeenCalled();
    const args = BlobMock.mock.calls[0] as unknown[];
    expect((args[1] as { type: string }).type).toContain("text/csv");
  });

  it("includes the title and headers in the CSV body", () => {
    exportToCSV({ title: "Bulletins", headers: ["Élève", "Moyenne"], rows: [["A", 14]] });
    const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
    const csvBody = String((BlobMock.mock.calls[0][0] as unknown[])[0]);
    expect(csvBody).toContain("Bulletins");
    expect(csvBody).toContain("Élève");
    expect(csvBody).toContain("Moyenne");
  });
});
