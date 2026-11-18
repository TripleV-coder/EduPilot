// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { subscribeLiveNotifications, useLiveNotifications, type LiveEvent } from "@/hooks/use-live-notifications";

/** EventSource minimal, piloté par le test. */
class FakeEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    static instances: FakeEventSource[] = [];
    readyState = FakeEventSource.CONNECTING;
    onerror: (() => void) | null = null;
    closed = false;
    private readonly handlers = new Map<string, ((event: MessageEvent<string>) => void)[]>();
    constructor(readonly url: string) {
        FakeEventSource.instances.push(this);
    }
    addEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
        this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    }
    emit(type: string, data: unknown) {
        this.readyState = FakeEventSource.OPEN;
        for (const handler of this.handlers.get(type) ?? []) handler({ data: JSON.stringify(data) } as MessageEvent<string>);
    }
    fail(readyState: number) {
        this.readyState = readyState;
        this.onerror?.();
    }
    close() {
        this.closed = true;
        this.readyState = FakeEventSource.CLOSED;
    }
}

const item = { id: "n1", type: "MESSAGE", title: "Nouveau message", message: "…", link: "/dashboard/messages", createdAt: new Date().toISOString() };

beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("useLiveNotifications", () => {
    it("une seule connexion partagée par tous les abonnés, fermée au dernier départ", () => {
        const a = renderHook(() => useLiveNotifications(() => {}));
        const b = renderHook(() => useLiveNotifications(() => {}));
        expect(FakeEventSource.instances).toHaveLength(1);
        expect(FakeEventSource.instances[0].url).toBe("/api/notifications/stream");
        a.unmount();
        expect(FakeEventSource.instances[0].closed).toBe(false);
        b.unmount();
        expect(FakeEventSource.instances[0].closed).toBe(true);
    });

    it("transmet les notifications ; rien à la première connexion, « reconnected » ensuite", () => {
        const seen: LiveEvent[] = [];
        const hook = renderHook(() => useLiveNotifications((event) => seen.push(event)));
        const es = FakeEventSource.instances[0];
        es.emit("connected", { userId: "u" });
        es.emit("notifications", [item]);
        es.emit("notifications", []);
        expect(seen).toEqual([{ kind: "notifications", items: [item] }]);
        // Reconnexion automatique du navigateur (coupure, fin de connexion)
        es.emit("connected", { userId: "u" });
        expect(seen.at(-1)).toEqual({ kind: "reconnected" });
        hook.unmount();
    });

    it("nouvel essai après un refus : « reconnected » dès la connexion rétablie", () => {
        const seen: LiveEvent[] = [];
        const off = subscribeLiveNotifications((event) => seen.push(event));
        FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
        vi.advanceTimersByTime(30_000);
        FakeEventSource.instances[1].emit("connected", { userId: "u" });
        expect(seen).toEqual([{ kind: "reconnected" }]);
        off();
    });

    it("désactivé (pas de session) : aucune connexion", () => {
        const hook = renderHook(() => useLiveNotifications(() => {}, false));
        expect(FakeEventSource.instances).toHaveLength(0);
        hook.unmount();
    });

    it("coupure réseau : le navigateur réessaie seul, aucune seconde connexion", () => {
        const off = subscribeLiveNotifications(() => {});
        FakeEventSource.instances[0].fail(FakeEventSource.CONNECTING);
        vi.advanceTimersByTime(600_000);
        expect(FakeEventSource.instances).toHaveLength(1);
        off();
    });

    it("refus du serveur : nouvel essai après 30 s, puis 60 s", () => {
        const off = subscribeLiveNotifications(() => {});
        FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
        vi.advanceTimersByTime(29_999);
        expect(FakeEventSource.instances).toHaveLength(1);
        vi.advanceTimersByTime(1);
        expect(FakeEventSource.instances).toHaveLength(2);
        FakeEventSource.instances[1].fail(FakeEventSource.CLOSED);
        vi.advanceTimersByTime(59_999);
        expect(FakeEventSource.instances).toHaveLength(2);
        vi.advanceTimersByTime(1);
        expect(FakeEventSource.instances).toHaveLength(3);
        off();
    });

    it("le dernier abonné parti : aucun nouvel essai programmé", () => {
        const off = subscribeLiveNotifications(() => {});
        FakeEventSource.instances[0].fail(FakeEventSource.CLOSED);
        off();
        vi.advanceTimersByTime(600_000);
        expect(FakeEventSource.instances).toHaveLength(1);
    });
});
