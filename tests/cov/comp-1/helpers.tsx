/**
 * Outils partagés des tests du lot comp-1 (composants dashboard / analytics / students).
 *
 * - installDomPolyfills() : API absentes de jsdom mais utilisées par Radix
 *   (pointer capture, scrollIntoView) et Recharts (ResizeObserver).
 * - chooseSelectOption() : ouvre un Select Radix au clavier et choisit une option
 *   par son nom accessible, comme le ferait un utilisateur au clavier.
 */
import { fireEvent, screen } from "@testing-library/react";

export function installDomPolyfills() {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
    if (!proto.setPointerCapture) proto.setPointerCapture = () => undefined;
    if (!proto.releasePointerCapture) proto.releasePointerCapture = () => undefined;
    if (!proto.scrollIntoView) proto.scrollIntoView = () => undefined;
    const g = globalThis as unknown as Record<string, unknown>;
    if (!g.ResizeObserver) {
        g.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
}

/** Ouvre le Select désigné par son nom accessible puis choisit l'option `optionName`. */
export async function chooseSelectOption(triggerName: string | RegExp, optionName: string | RegExp) {
    const trigger = screen.getByRole("combobox", { name: triggerName });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const option = await screen.findByRole("option", { name: optionName });
    fireEvent.keyDown(option, { key: "Enter" });
}
