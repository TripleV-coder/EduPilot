// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import useSWR, { SWRConfig } from "swr";
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation";

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: unknown[]) => toastMock(...args) }));

afterEach(() => {
    cleanup();
    toastMock.mockClear();
});

type Item = { id: number };

function Harness({
    mutationFn,
    revalidate,
}: {
    mutationFn: () => Promise<unknown>;
    revalidate?: boolean;
}) {
    const { data } = useSWR<Item[]>("k", () => Promise.resolve([{ id: 1 }]));
    const { trigger } = useOptimisticMutation<Item[], { id: number }>({
        key: "k",
        mutationFn,
        optimisticUpdate: (current, vars) => [...(current ?? []), { id: vars.id }],
        errorMessage: "échec",
        revalidate,
    });
    return (
        <div>
            <span data-testid="ids">{(data ?? []).map((i) => i.id).join(",")}</span>
            <button onClick={() => void trigger({ id: 2 }).catch(() => {})}>go</button>
        </div>
    );
}

function renderWithSwr(ui: React.ReactElement) {
    return render(<SWRConfig value={{ provider: () => new Map() }}>{ui}</SWRConfig>);
}

describe("useOptimisticMutation", () => {
    it("applique la mise à jour optimiste et la conserve en cas de succès", async () => {
        const mutationFn = vi.fn().mockResolvedValue(undefined);
        renderWithSwr(<Harness mutationFn={mutationFn} revalidate={false} />);
        await waitFor(() => expect(screen.getByTestId("ids").textContent).toBe("1"));
        fireEvent.click(screen.getByText("go"));
        await waitFor(() => expect(screen.getByTestId("ids").textContent).toBe("1,2"));
        expect(mutationFn).toHaveBeenCalledTimes(1);
    });

    it("annule (rollback) et notifie en cas d'échec", async () => {
        const mutationFn = vi.fn().mockRejectedValue(new Error("nope"));
        renderWithSwr(<Harness mutationFn={mutationFn} revalidate={false} />);
        await waitFor(() => expect(screen.getByTestId("ids").textContent).toBe("1"));
        fireEvent.click(screen.getByText("go"));
        await waitFor(() =>
            expect(toastMock).toHaveBeenCalledWith(
                expect.objectContaining({ variant: "destructive" }),
            ),
        );
        await waitFor(() => expect(screen.getByTestId("ids").textContent).toBe("1"));
    });
});
