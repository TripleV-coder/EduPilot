// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { screen, cleanup, fireEvent, render, act, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { useForm } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import { Inbox } from "lucide-react";

vi.mock("@/lib/ux/telemetry", () => ({ trackUxEvent: vi.fn() }));
import { trackUxEvent } from "@/lib/ux/telemetry";

import { DataTable } from "@/components/ui/data-table";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, EmptyStateAction } from "@/components/ui/empty-state";
import { Toaster } from "@/components/ui/toaster";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton, ChartSkeleton, PageSkeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton-page";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { MetricCardPro } from "@/components/ui/metric-card-pro";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionToolbar } from "@/components/ui/section-toolbar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Radix (Select, Popover…) s'appuie sur des API de pointeur/défilement absentes de jsdom.
beforeAll(() => {
    const proto = Element.prototype as unknown as Record<string, unknown>;
    proto.hasPointerCapture ??= () => false;
    proto.setPointerCapture ??= () => {};
    proto.releasePointerCapture ??= () => {};
    proto.scrollIntoView ??= () => {};
    if (!("ResizeObserver" in globalThis)) {
        class RO {
            observe() {}
            unobserve() {}
            disconnect() {}
        }
        (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
    }
});

afterEach(() => {
    cleanup();
    vi.mocked(trackUxEvent).mockClear();
});

// ─────────────────────────────────────────────────────────────────────────
type Eleve = { nom: string; moyenne: number };
const COLONNES: ColumnDef<Eleve, unknown>[] = [
    { accessorKey: "nom", header: "Nom" },
    { accessorKey: "moyenne", header: "Moyenne" },
];
const eleves = (n: number): Eleve[] => Array.from({ length: n }, (_, i) => ({ nom: `Élève ${i + 1}`, moyenne: 10 + (i % 10) }));

describe("DataTable", () => {
    it("affiche « Aucun résultat » sans données et une page unique désactivée", () => {
        render(<DataTable columns={COLONNES} data={[]} />);
        expect(screen.getByText("Aucun résultat.")).toBeInTheDocument();
        expect(screen.getByText("Page 1 sur 1")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Première page" })).toBeDisabled();
        // Pas de champ de filtre sans searchKey.
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("pagine avec les boutons et les numéros de page (petit nombre de pages)", () => {
        render(<DataTable columns={COLONNES} data={eleves(25)} />);
        expect(screen.getByText("Élève 1")).toBeInTheDocument();
        expect(screen.getByText("Page 1 sur 3")).toBeInTheDocument();
        expect(screen.getByText("0 sur 25 ligne(s) sélectionnée(s)")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
        expect(screen.getByText("Page 2 sur 3")).toBeInTheDocument();
        expect(screen.getByText("Élève 11")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Dernière page" }));
        expect(screen.getByText("Page 3 sur 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Page précédente" }));
        expect(screen.getByText("Page 2 sur 3")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Première page" }));
        expect(screen.getByText("Page 1 sur 3")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "3" }));
        expect(screen.getByText("Page 3 sur 3")).toBeInTheDocument();
    });

    it("affiche des ellipses autour de la page courante quand il y a beaucoup de pages", () => {
        render(<DataTable columns={COLONNES} data={eleves(100)} />);
        // Page 1 sur 10 : 1 2 … 10
        expect(screen.getByText("Page 1 sur 10")).toBeInTheDocument();
        expect(screen.getAllByText("...")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", { name: "2" }));
        fireEvent.click(screen.getByRole("button", { name: "3" }));
        fireEvent.click(screen.getByRole("button", { name: "4" }));
        // Page 4 : 1 … 3 4 5 … 10
        expect(screen.getByText("Page 4 sur 10")).toBeInTheDocument();
        expect(screen.getAllByText("...")).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", { name: "Dernière page" }));
        // Page 10 : 1 … 9 10
        expect(screen.getAllByText("...")).toHaveLength(1);
        expect(screen.getByRole("button", { name: "10" })).toHaveClass("pointer-events-none");
    });

    it("filtre sur la colonne de recherche", () => {
        render(<DataTable columns={COLONNES} data={eleves(12)} searchKey="nom" searchPlaceholder="Chercher un élève" />);
        const input = screen.getByPlaceholderText("Chercher un élève");
        fireEvent.change(input, { target: { value: "Élève 12" } });
        expect(screen.getByText("Élève 12")).toBeInTheDocument();
        expect(screen.queryByText("Élève 1")).not.toBeInTheDocument();
        expect(input).toHaveValue("Élève 12");
        fireEvent.change(input, { target: { value: "personne" } });
        expect(screen.getByText("Aucun résultat.")).toBeInTheDocument();
    });

    it("une clé de recherche inconnue ne plante pas", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        render(<DataTable columns={COLONNES} data={eleves(2)} searchKey="inexistante" />);
        const input = screen.getByPlaceholderText("Filtrer...");
        fireEvent.change(input, { target: { value: "x" } });
        expect(screen.getByText("Élève 1")).toBeInTheDocument();
        spy.mockRestore();
    });

    it("change le nombre de lignes par page via le sélecteur", async () => {
        render(<DataTable columns={COLONNES} data={eleves(30)} pageSizeOptions={[10, 25]} />);
        const trigger = screen.getByRole("combobox", { name: "Lignes par page" });
        fireEvent.keyDown(trigger, { key: "Enter" });
        const option = await screen.findByRole("option", { name: "25" });
        fireEvent.keyDown(option, { key: "Enter" });
        await waitFor(() => expect(screen.getByText("Page 1 sur 2")).toBeInTheDocument());
        expect(screen.getByText("Élève 25")).toBeInTheDocument();
    });

    it("rend un en-tête vide pour les colonnes groupées (placeholder)", () => {
        const grouped: ColumnDef<Eleve, unknown>[] = [
            { header: "Identité", columns: [{ accessorKey: "nom", header: "Nom" }] },
            { accessorKey: "moyenne", header: "Moyenne" },
        ];
        render(<DataTable columns={grouped} data={eleves(1)} />);
        expect(screen.getByText("Identité")).toBeInTheDocument();
        expect(screen.getAllByRole("columnheader").some((th) => th.textContent === "")).toBe(true);
    });
});

describe("Table (primitives)", () => {
    it("rend un tableau complet accessible avec légende et pied", () => {
        render(
            <Table className="perso">
                <TableCaption>Liste des classes</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Classe</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>6e A</TableCell>
                    </TableRow>
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell>Total : 1</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>,
        );
        const table = screen.getByRole("table", { name: "Liste des classes" });
        expect(table).toHaveClass("perso");
        expect(screen.getByRole("columnheader", { name: "Classe" })).toBeInTheDocument();
        expect(screen.getByRole("cell", { name: "Total : 1" })).toBeInTheDocument();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("EmptyState", () => {
    it("variante vide par défaut, avec description et télémétrie d'affichage", () => {
        render(<EmptyState title="Aucun élève" description="Ajoutez un premier élève." telemetryKey="eleves_vide" />);
        expect(screen.getByRole("heading", { name: "Aucun élève" })).toBeInTheDocument();
        expect(screen.getByText("Ajoutez un premier élève.")).toBeInTheDocument();
        expect(trackUxEvent).toHaveBeenCalledWith("empty_state_view", { key: "eleves_vide", title: "Aucun élève" });
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("actions multiples : lien puis bouton, avec télémétrie de clic", () => {
        const retry = vi.fn();
        render(
            <EmptyState
                variant="error"
                title="Erreur de chargement"
                telemetryKey="err"
                actions={[
                    { label: "Retour", href: "/dashboard" },
                    { label: "Réessayer", onClick: retry },
                    { label: "Discret", onClick: retry, variant: "ghost" },
                ]}
            />,
        );
        const link = screen.getByRole("link", { name: "Retour" });
        expect(link).toHaveAttribute("href", "/dashboard");
        fireEvent.click(link);
        fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
        expect(retry).toHaveBeenCalledTimes(1);
        expect(trackUxEvent).toHaveBeenCalledWith("empty_state_action_click", { key: "err", title: "Erreur de chargement" });
        expect(vi.mocked(trackUxEvent).mock.calls.filter((c) => c[0] === "empty_state_action_click")).toHaveLength(2);
    });

    it("raccourci actionLabel/onAction sans télémétrie, et nœud d'action libre", () => {
        const onAction = vi.fn();
        render(
            <EmptyState
                variant="no-permission"
                icon={Inbox}
                title="Accès restreint"
                actionLabel="Demander l'accès"
                onAction={onAction}
                action={<span>Contactez la direction</span>}
                animate={false}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Demander l'accès" }));
        expect(onAction).toHaveBeenCalled();
        expect(trackUxEvent).not.toHaveBeenCalled();
        expect(screen.getByText("Contactez la direction")).toBeInTheDocument();
    });

    it("mode carte (et alias déprécié EmptyStateAction) avec lien raccourci", () => {
        const { container } = render(<EmptyStateAction title="Aucun cours" actionLabel="Créer un cours" actionHref="/dashboard/courses/new" />);
        expect(screen.getByRole("link", { name: "Créer un cours" })).toHaveAttribute("href", "/dashboard/courses/new");
        expect(container.querySelector(".border-dashed")).not.toBeNull();
        cleanup();
        const { container: c2 } = render(<EmptyState card animate={false} title="Vide" />);
        expect(c2.querySelector(".edu-enter-up")).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Toaster / Toast", () => {
    it("affiche un toast avec titre, description et action, et le ferme", async () => {
        const onUndo = vi.fn();
        render(<Toaster />);
        act(() => {
            toast({
                title: "Note enregistrée",
                description: "La moyenne a été recalculée.",
                action: (
                    <ToastAction altText="Annuler la saisie" onClick={onUndo}>
                        Annuler
                    </ToastAction>
                ),
            });
        });
        expect(await screen.findByText("Note enregistrée")).toBeInTheDocument();
        expect(screen.getByText("La moyenne a été recalculée.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
        expect(onUndo).toHaveBeenCalled();
    });

    it("toast destructif sans titre ni description, fermeture par la croix", async () => {
        render(<Toaster />);
        act(() => {
            toast({ variant: "destructive" });
        });
        const close = await screen.findByRole("button");
        expect(close).toHaveAttribute("toast-close", "");
        fireEvent.click(close);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Primitives Radix habillées", () => {
    it("Accordéon : le déclencheur déplie le contenu (aria-expanded)", () => {
        render(
            <Accordion type="single" collapsible>
                <AccordionItem value="a">
                    <AccordionTrigger>Frais de scolarité</AccordionTrigger>
                    <AccordionContent>Payables en trois tranches.</AccordionContent>
                </AccordionItem>
            </Accordion>,
        );
        const trigger = screen.getByRole("button", { name: "Frais de scolarité" });
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("Payables en trois tranches.")).toBeInTheDocument();
    });

    it("Onglets : sélection au clic (aria-selected)", () => {
        render(
            <Tabs defaultValue="notes">
                <TabsList>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                    <TabsTrigger value="absences">Absences</TabsTrigger>
                </TabsList>
                <TabsContent value="notes">Contenu notes</TabsContent>
                <TabsContent value="absences">Contenu absences</TabsContent>
            </Tabs>,
        );
        const tab = screen.getByRole("tab", { name: "Absences" });
        fireEvent.mouseDown(tab, { button: 0 });
        expect(tab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tabpanel")).toHaveTextContent("Contenu absences");
    });

    it("Popover : s'ouvre au clic et se ferme avec Échap", async () => {
        render(
            <Popover>
                <PopoverTrigger>Filtres</PopoverTrigger>
                <PopoverContent>Contenu des filtres</PopoverContent>
            </Popover>,
        );
        const trigger = screen.getByRole("button", { name: "Filtres" });
        fireEvent.click(trigger);
        expect(await screen.findByText("Contenu des filtres")).toBeInTheDocument();
        expect(trigger).toHaveAttribute("aria-expanded", "true");
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByText("Contenu des filtres")).not.toBeInTheDocument());
    });

    it("Groupe radio : cocher une option", () => {
        const onChange = vi.fn();
        render(
            <RadioGroup aria-label="Trimestre" onValueChange={onChange}>
                <RadioGroupItem value="t1" aria-label="T1" />
                <RadioGroupItem value="t2" aria-label="T2" />
            </RadioGroup>,
        );
        const t2 = screen.getByRole("radio", { name: "T2" });
        fireEvent.click(t2);
        expect(onChange).toHaveBeenCalledWith("t2");
        expect(t2).toHaveAttribute("aria-checked", "true");
    });

    it("Infobulle : apparaît au focus du déclencheur", async () => {
        render(
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger>Aide</TooltipTrigger>
                    <TooltipContent>Explication détaillée</TooltipContent>
                </Tooltip>
            </TooltipProvider>,
        );
        fireEvent.focus(screen.getByRole("button", { name: "Aide" }));
        expect(await screen.findByRole("tooltip")).toHaveTextContent("Explication détaillée");
    });

    it("Case à cocher et interrupteur basculent leur état", () => {
        render(
            <>
                <Checkbox aria-label="Présent" />
                <Switch aria-label="Notifications" />
            </>,
        );
        const cb = screen.getByRole("checkbox", { name: "Présent" });
        fireEvent.click(cb);
        expect(cb).toHaveAttribute("aria-checked", "true");
        const sw = screen.getByRole("switch", { name: "Notifications" });
        fireEvent.click(sw);
        expect(sw).toHaveAttribute("aria-checked", "true");
    });

    it("Barre de progression : valeur annoncée, ou indéterminée sans valeur", () => {
        render(
            <>
                <Progress aria-label="Recouvrement" value={40} indicatorColor="bg-success" />
                <Progress aria-label="Chargement" />
            </>,
        );
        expect(screen.getByRole("progressbar", { name: "Recouvrement" })).toHaveAttribute("aria-valuenow", "40");
        expect(screen.getByRole("progressbar", { name: "Chargement" })).not.toHaveAttribute("aria-valuenow");
    });

    it("Select : groupe, étiquette et séparateur ; choix au clavier", async () => {
        const onChange = vi.fn();
        render(
            <Select onValueChange={onChange}>
                <SelectTrigger aria-label="Classe">
                    <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent position="item-aligned">
                    <SelectGroup>
                        <SelectLabel>Collège</SelectLabel>
                        <SelectItem value="6a">6e A</SelectItem>
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectItem value="2nde">2nde C</SelectItem>
                </SelectContent>
            </Select>,
        );
        expect(screen.getByText("Choisir une classe")).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole("combobox", { name: "Classe" }), { key: "ArrowDown" });
        expect(await screen.findByText("Collège")).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole("option", { name: "2nde C" }), { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("2nde");
    });

    it("Sheet : panneau latéral avec titre, description, pied et bouton de fermeture", async () => {
        render(
            <Sheet>
                <SheetTrigger>Ouvrir le panneau</SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader>
                        <SheetTitle>Détails élève</SheetTitle>
                        <SheetDescription>Informations complètes</SheetDescription>
                    </SheetHeader>
                    <SheetFooter>
                        <button>Enregistrer</button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Ouvrir le panneau" }));
        const dialog = await screen.findByRole("dialog", { name: "Détails élève" });
        expect(dialog).toHaveAccessibleDescription("Informations complètes");
        fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
});

// ─────────────────────────────────────────────────────────────────────────
type Valeurs = { email: string };

function FormulaireTest({ withError = false }: { withError?: boolean }) {
    const form = useForm<Valeurs>({ defaultValues: { email: "" } });
    React.useEffect(() => {
        if (withError) form.setError("email", { message: "Adresse invalide" });
    }, [withError, form]);
    return (
        <Form {...form}>
            <form>
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Adresse e-mail</FormLabel>
                            <FormControl>
                                <input {...field} />
                            </FormControl>
                            <FormDescription>Utilisée pour la connexion.</FormDescription>
                            <FormMessage>Message d'aide</FormMessage>
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    );
}

describe("Form (react-hook-form)", () => {
    it("relie étiquette, champ et description sans erreur", () => {
        render(<FormulaireTest />);
        const input = screen.getByLabelText("Adresse e-mail");
        expect(input).toHaveAttribute("aria-invalid", "false");
        expect(input).toHaveAccessibleDescription("Utilisée pour la connexion.");
        expect(screen.getByText("Message d'aide")).toBeInTheDocument();
    });

    it("affiche l'erreur et marque le champ invalide", async () => {
        render(<FormulaireTest withError />);
        expect(await screen.findByText("Adresse invalide")).toBeInTheDocument();
        const input = screen.getByLabelText("Adresse e-mail");
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(input).toHaveAccessibleDescription("Utilisée pour la connexion. Adresse invalide");
        expect(screen.getByText("Adresse e-mail")).toHaveClass("text-destructive");
    });

    it("FormMessage sans erreur ni contenu ne rend rien", () => {
        function Vide() {
            const form = useForm<Valeurs>({ defaultValues: { email: "" } });
            return (
                <Form {...form}>
                    <FormField control={form.control} name="email" render={() => <FormItem><FormMessage /></FormItem>} />
                </Form>
            );
        }
        const { container } = render(<Vide />);
        expect(container.querySelector("p")).toBeNull();
    });

    it("lève une erreur explicite hors de FormField ou de FormItem", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        function HorsChamp() {
            const form = useForm<Valeurs>();
            return (
                <Form {...form}>
                    <FormItem>
                        <FormLabel>x</FormLabel>
                    </FormItem>
                </Form>
            );
        }
        expect(() => render(<HorsChamp />)).toThrow("useFormField should be used within <FormField>");
        function HorsItem() {
            const form = useForm<Valeurs>();
            return (
                <Form {...form}>
                    <FormField control={form.control} name="email" render={() => <FormDescription>x</FormDescription>} />
                </Form>
            );
        }
        expect(() => render(<HorsItem />)).toThrow("useFormField should be used within <FormItem>");
        spy.mockRestore();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Composants de présentation", () => {
    it("MetricCardPro : libellé, valeur, indice optionnel et tonalité", () => {
        const { container } = render(<MetricCardPro label="Élèves" value={412} hint="+12 ce mois" icon={Inbox} tone="success" />);
        expect(screen.getByText("Élèves")).toBeInTheDocument();
        expect(screen.getByText("412")).toBeInTheDocument();
        expect(screen.getByText("+12 ce mois")).toBeInTheDocument();
        // La tonalité se lit à la pastille de couleur de module (style validé).
        expect(container.innerHTML).toContain("--edu-module-green");
        cleanup();
        const { container: c2 } = render(<MetricCardPro label="Retards" value="3" icon={Inbox} />);
        expect(c2.innerHTML).toContain("--edu-module-blue");
        expect(screen.queryByText("+12 ce mois")).toBeNull();
    });

    it("Squelettes : base avec ou sans reflet et squelettes composés", () => {
        const { container } = render(
            <>
                <Skeleton data-testid="a" />
                <Skeleton data-testid="b" noShimmer />
                <StatCardSkeleton />
                <CardSkeleton />
                <TableSkeleton />
                <ChartSkeleton />
                <ChartSkeleton type="line" />
                <ChartSkeleton type="pie" />
                <ChartSkeleton type="radar" />
                <PageSkeleton />
            </>,
        );
        expect(screen.getByTestId("a").className).toContain("before:animate");
        expect(screen.getByTestId("b").className).not.toContain("before:animate");
        expect(container.querySelectorAll(".rounded-full.h-48").length).toBe(2);
    });

    it("TableSkeleton respecte le nombre de lignes demandé", () => {
        const { container } = render(<TableSkeleton rows={2} />);
        expect(container.querySelectorAll(".py-2")).toHaveLength(2);
    });

    it("Textarea, Badge et Card transmettent props et variantes", () => {
        render(
            <>
                <Textarea aria-label="Appréciation" defaultValue="Bon trimestre" />
                <Badge variant="success">Payé</Badge>
                <Badge>Défaut</Badge>
                <Card variant="glass" data-testid="carte">
                    <CardHeader>
                        <CardTitle>Résumé</CardTitle>
                        <CardDescription>Trimestre 1</CardDescription>
                    </CardHeader>
                    <CardContent>Corps</CardContent>
                    <CardFooter>Pied</CardFooter>
                </Card>
            </>,
        );
        expect(screen.getByRole("textbox", { name: "Appréciation" })).toHaveValue("Bon trimestre");
        expect(screen.getByText("Payé").className).toContain("text-success");
        expect(screen.getByRole("heading", { level: 2, name: "Résumé" })).toBeInTheDocument();
        expect(screen.getByText("Trimestre 1")).toBeInTheDocument();
        expect(screen.getByText("Pied")).toBeInTheDocument();
        expect(screen.getByTestId("carte").className).toContain("backdrop-blur");
    });

    it("SectionToolbar : titre, description, zone de tête et actions optionnels", () => {
        render(<SectionToolbar title="Classes" description="12 classes" leading={<input aria-label="Filtre" />} actions={<button>Ajouter</button>} />);
        expect(screen.getByRole("heading", { name: "Classes" })).toBeInTheDocument();
        expect(screen.getByText("12 classes")).toBeInTheDocument();
        expect(screen.getByLabelText("Filtre")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ajouter" })).toBeInTheDocument();
        cleanup();
        const { container } = render(<SectionToolbar />);
        expect(container.querySelector("h2")).toBeNull();
        expect(container.querySelector("button")).toBeNull();
    });
});
