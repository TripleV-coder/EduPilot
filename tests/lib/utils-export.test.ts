import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportToCSV, ExportData } from "@/lib/utils/export";

/**
 * exportToCSV uses browser APIs (Blob, URL, document) — we stub them.
 */

describe("utils/export.exportToCSV", () => {
  const originalDocument = (globalThis as any).document;
  const originalURL = (globalThis as any).URL;
  const originalBlob = (globalThis as any).Blob;

  let appendedLink: any;

  beforeEach(() => {
    appendedLink = {
      setAttribute: vi.fn(),
      style: {} as any,
      click: vi.fn(),
    };

    (globalThis as any).document = {
      createElement: vi.fn(() => appendedLink),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
    (globalThis as any).URL = {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    };
    (globalThis as any).Blob = vi.fn().mockImplementation(function (this: any, parts: any, options: any) {
      this.parts = parts;
      this.options = options;
    });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).URL = originalURL;
    (globalThis as any).Blob = originalBlob;
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
    const doc: any = (globalThis as any).document;
    expect(doc.body.appendChild).toHaveBeenCalled();
    expect(doc.body.removeChild).toHaveBeenCalled();
  });

  it("creates a Blob with text/csv mime type", () => {
    exportToCSV({ title: "t", headers: ["A"], rows: [["1"]] });
    const BlobMock = (globalThis as any).Blob as unknown as ReturnType<typeof vi.fn>;
    expect(BlobMock).toHaveBeenCalled();
    const args = BlobMock.mock.calls[0];
    expect(args[1].type).toContain("text/csv");
  });

  it("includes the title and headers in the CSV body", () => {
    exportToCSV({ title: "Bulletins", headers: ["Élève", "Moyenne"], rows: [["A", 14]] });
    const BlobMock = (globalThis as any).Blob as unknown as ReturnType<typeof vi.fn>;
    const csvBody = String(BlobMock.mock.calls[0][0][0]);
    expect(csvBody).toContain("Bulletins");
    expect(csvBody).toContain("Élève");
    expect(csvBody).toContain("Moyenne");
  });
});
