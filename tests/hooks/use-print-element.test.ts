// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { printElement } from "@/hooks/use-print-element";

/** Impression native des bulletins (remplace react-to-print). */
afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    document.title = "";
});

function bulletins(count: number) {
    const container = document.createElement("div");
    for (let i = 0; i < count; i++) {
        const page = document.createElement("div");
        page.className = "bulletin-a4 bulletin-page";
        page.style.width = "794px";
        page.textContent = `Bulletin ${i + 1}`;
        container.appendChild(page);
    }
    document.body.appendChild(container);
    return container;
}

describe("printElement", () => {
    it("pendant l'impression : copie isolée, feuille A4, titre du PDF", () => {
        document.title = "EduPilot";
        const source = bulletins(3);
        let seen: { pages: number; title: string; style: string | null; inlineWidth: string } | null = null;
        vi.spyOn(window, "print").mockImplementation(() => {
            const root = document.getElementById("edupilot-print-root")!;
            const first = root.querySelector<HTMLElement>(".bulletin-page")!;
            seen = {
                pages: root.querySelectorAll(".bulletin-page").length,
                title: document.title,
                style: document.getElementById("edupilot-print-style")?.textContent ?? null,
                inlineWidth: first.style.width,
            };
        });

        printElement(source, "Bulletins_6eA_Trimestre1");

        expect(window.print).toHaveBeenCalledTimes(1);
        expect(seen).not.toBeNull();
        expect(seen!.pages).toBe(3);
        expect(seen!.title).toBe("Bulletins_6eA_Trimestre1");
        expect(seen!.inlineWidth).toBe("794px"); // styles en ligne conservés
        expect(seen!.style).toContain("size: A4");
        expect(seen!.style).toContain("break-after: page");
        expect(seen!.style).toContain("body > *:not(#edupilot-print-root) { display: none !important; }");
        // L'original n'est pas déplacé
        expect(source.isConnected).toBe(true);
    });

    it("après l'impression : tout est rétabli (titre, copie, feuille)", async () => {
        document.title = "EduPilot";
        vi.spyOn(window, "print").mockImplementation(() => undefined);

        printElement(bulletins(1), "Bulletin_Doe_T1");
        window.dispatchEvent(new Event("afterprint"));

        expect(document.title).toBe("EduPilot");
        expect(document.getElementById("edupilot-print-root")).toBeNull();
        expect(document.getElementById("edupilot-print-style")).toBeNull();
    });

    it("rétablit aussi sans événement afterprint (navigateur qui ne l'émet pas)", async () => {
        document.title = "EduPilot";
        vi.spyOn(window, "print").mockImplementation(() => undefined);
        printElement(bulletins(1), "Bulletin");
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(document.title).toBe("EduPilot");
        expect(document.getElementById("edupilot-print-root")).toBeNull();
    });

    it("deux impressions de suite ne laissent qu'une seule copie", () => {
        vi.spyOn(window, "print").mockImplementation(() => undefined);
        printElement(bulletins(1), "A");
        printElement(bulletins(2), "B");
        expect(document.querySelectorAll("#edupilot-print-root")).toHaveLength(1);
    });
});
