// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoSave } from "@/hooks/use-autosave";

describe("useAutoSave", () => {
    it("ne sauvegarde pas au montage (données inchangées)", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderHook(() => useAutoSave({ data: { n: 1 }, onSave, delay: 30 }));
        await new Promise((r) => setTimeout(r, 120));
        expect(onSave).not.toHaveBeenCalled();
    });

    it("sauvegarde après debounce quand les données changent", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            ({ data }) => useAutoSave({ data, onSave, delay: 30 }),
            { initialProps: { data: { n: 1 } } },
        );
        rerender({ data: { n: 2 } });
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave).toHaveBeenCalledWith({ n: 2 });
        await waitFor(() => expect(result.current.status).toBe("saved"));
        expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    });

    it("bloque la sauvegarde si validate renvoie false", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { rerender } = renderHook(
            ({ data }) =>
                useAutoSave({ data, onSave, delay: 20, validate: (d) => d.n > 0 }),
            { initialProps: { data: { n: 1 } } },
        );
        rerender({ data: { n: -1 } });
        await new Promise((r) => setTimeout(r, 100));
        expect(onSave).not.toHaveBeenCalled();
    });

    it("passe en état error si onSave rejette", async () => {
        const onSave = vi.fn().mockRejectedValue(new Error("boom"));
        const { result, rerender } = renderHook(
            ({ data }) => useAutoSave({ data, onSave, delay: 20 }),
            { initialProps: { data: { n: 1 } } },
        );
        rerender({ data: { n: 2 } });
        await waitFor(() => expect(result.current.status).toBe("error"));
        expect(result.current.error).toBe("boom");
    });

    it("saveNow force la sauvegarde immédiate", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { result, rerender } = renderHook(
            ({ data }) => useAutoSave({ data, onSave, delay: 10000 }),
            { initialProps: { data: { n: 1 } } },
        );
        rerender({ data: { n: 9 } });
        await act(async () => {
            result.current.saveNow();
        });
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ n: 9 }));
    });
});
