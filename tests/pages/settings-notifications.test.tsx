// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("./harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("./harness")).schoolMock);
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: (...args: unknown[]) => toastSuccess(...args), info: vi.fn() } }));

import { asRole, mockApi, renderPage, resetHarness } from "./harness";
import NotificationsSettingsPage from "@/app/(dashboard)/dashboard/settings/notifications/page";

const PUSH_ON = { configured: true, publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U", devices: 0 };

/** Navigateur compatible push : service worker actif, PushManager, Notification. */
function fakePushBrowser(options: { permission?: NotificationPermission; subscribed?: boolean } = {}) {
    const subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        options: { applicationServerKey: null },
        toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: `B${"x".repeat(86)}`, auth: "a".repeat(22) } }),
        unsubscribe: vi.fn().mockResolvedValue(true),
    };
    const pushManager = {
        getSubscription: vi.fn().mockResolvedValue(options.subscribed ? subscription : null),
        subscribe: vi.fn().mockResolvedValue(subscription),
    };
    const notification = { permission: options.permission ?? "default", requestPermission: vi.fn().mockResolvedValue("granted") };
    vi.stubGlobal("Notification", notification);
    vi.stubGlobal("PushManager", function PushManager() {});
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: { getRegistration: vi.fn().mockResolvedValue({ pushManager }) },
    });
    return { pushManager, notification, subscription };
}

afterEach(() => {
    cleanup();
    resetHarness();
    toastError.mockReset();
    toastSuccess.mockReset();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("Page Notifications", () => {
    it("ne montre plus les six interrupteurs sans effet ; indique les non-lues", async () => {
        asRole("PARENT");
        mockApi({ "GET /api/notifications": { unreadCount: 3 }, "GET /api/push/subscription": { ...PUSH_ON, configured: false, publicKey: null } });
        renderPage(<NotificationsSettingsPage />);

        expect(await screen.findByText("3 notifications non lues.")).toBeInTheDocument();
        expect(screen.queryByText(/Digest hebdomadaire/)).not.toBeInTheDocument();
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Enregistrer les préférences/ })).not.toBeInTheDocument();
    });

    it("plateforme sans clés push : le dit, sans bouton d'activation", async () => {
        asRole("PARENT");
        fakePushBrowser();
        mockApi({ "GET /api/notifications": { unreadCount: 0 }, "GET /api/push/subscription": { configured: false, publicKey: null, devices: 0 } });
        renderPage(<NotificationsSettingsPage />);

        expect(await screen.findByText(/pas encore activées sur la plateforme EduPilot/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Activer sur cet appareil/ })).not.toBeInTheDocument();
    });

    it("navigateur sans notifications push : le dit", async () => {
        asRole("PARENT");
        mockApi({ "GET /api/notifications": { unreadCount: 0 }, "GET /api/push/subscription": PUSH_ON });
        renderPage(<NotificationsSettingsPage />);

        expect(await screen.findByText(/Ce navigateur ne permet pas les notifications push/)).toBeInTheDocument();
    });

    it("active les notifications sur l'appareil : accord du navigateur, puis abonnement enregistré", async () => {
        asRole("PARENT");
        const browser = fakePushBrowser();
        const api = mockApi({
            "GET /api/notifications": { unreadCount: 0 },
            "GET /api/push/subscription": PUSH_ON,
            "POST /api/push/subscription": { subscribed: true },
        });
        renderPage(<NotificationsSettingsPage />);

        fireEvent.click(await screen.findByRole("button", { name: /Activer sur cet appareil/ }));
        await waitFor(() => expect(api.calls("POST /api/push/subscription")).toHaveLength(1));
        expect(browser.notification.requestPermission).toHaveBeenCalled();
        expect(browser.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
        expect(api.calls("POST /api/push/subscription")[0].body).toMatchObject({ endpoint: "https://fcm.googleapis.com/fcm/send/abc" });
        expect(toastSuccess).toHaveBeenCalledWith("Notifications activées sur cet appareil.");
    });

    it("notifications bloquées dans le navigateur : explique comment les autoriser", async () => {
        asRole("PARENT");
        fakePushBrowser({ permission: "denied" });
        mockApi({ "GET /api/notifications": { unreadCount: 0 }, "GET /api/push/subscription": PUSH_ON });
        renderPage(<NotificationsSettingsPage />);

        expect(await screen.findByText(/sont bloquées dans ce navigateur/)).toBeInTheDocument();
    });

    it("appareil déjà abonné : essai et désactivation", async () => {
        asRole("PARENT");
        const browser = fakePushBrowser({ permission: "granted", subscribed: true });
        const api = mockApi({
            "GET /api/notifications": { unreadCount: 0 },
            "GET /api/push/subscription": { ...PUSH_ON, devices: 1 },
            "POST /api/push/test": { sent: 1, failed: 0, removed: 0 },
            "DELETE /api/push/subscription": { removed: 1 },
        });
        renderPage(<NotificationsSettingsPage />);

        expect(await screen.findByText("Activées sur cet appareil.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Envoyer un essai/ }));
        await waitFor(() => expect(api.calls("POST /api/push/test")).toHaveLength(1));

        fireEvent.click(screen.getByRole("button", { name: /Désactiver sur cet appareil/ }));
        await waitFor(() => expect(api.calls("DELETE /api/push/subscription")).toHaveLength(1));
        expect(browser.subscription.unsubscribe).toHaveBeenCalled();
    });
});
