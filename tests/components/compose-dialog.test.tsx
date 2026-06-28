// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ComposeDialog } from "@/components/messaging/compose-dialog";

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof ComposeDialog>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <ComposeDialog
      open
      onClose={onClose}
      title="Messagerie groupe"
      submitLabel="Diffuser"
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onClose, onSubmit };
}

describe("ComposeDialog", () => {
  it("ne rend rien quand open=false", () => {
    render(<ComposeDialog open={false} onClose={() => {}} title="X" onSubmit={async () => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rend le dialog avec son titre quand open", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Messagerie groupe" })).toBeInTheDocument();
  });

  it("le bouton Fermer déclenche onClose", () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByLabelText("Fermer"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Escape ferme le dialog", () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("le bouton d'envoi est désactivé tant que sujet+contenu ne sont pas remplis", () => {
    setup();
    const submit = screen.getByRole("button", { name: "Diffuser" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Objet du message"), { target: { value: "Réunion" } });
    expect(submit).toBeDisabled(); // contenu encore vide
    fireEvent.change(screen.getByPlaceholderText("Votre message…"), { target: { value: "Demain 17h" } });
    expect(submit).toBeEnabled();
  });

  it("soumet les valeurs trimmées et affiche le succès", async () => {
    const { onSubmit } = setup({ successMessage: "Diffusé !" });
    fireEvent.change(screen.getByPlaceholderText("Objet du message"), { target: { value: "  Sujet  " } });
    fireEvent.change(screen.getByPlaceholderText("Votre message…"), { target: { value: "  Corps  " } });
    fireEvent.click(screen.getByRole("button", { name: "Diffuser" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ subject: "Sujet", content: "Corps" }));
    expect(await screen.findByText("Diffusé !")).toBeInTheDocument();
  });

  it("affiche le message d'erreur si onSubmit échoue", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Réseau coupé"));
    render(
      <ComposeDialog open onClose={() => {}} title="X" submitLabel="Envoyer" onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Objet du message"), { target: { value: "S" } });
    fireEvent.change(screen.getByPlaceholderText("Votre message…"), { target: { value: "C" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Réseau coupé");
  });

  it("contentOptional : envoi possible sans corps (note libre)", () => {
    setup({ contentOptional: true, showSubject: false });
    expect(screen.getByRole("button", { name: "Diffuser" })).toBeEnabled();
  });
});
