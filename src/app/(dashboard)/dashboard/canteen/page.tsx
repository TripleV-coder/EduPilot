"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { fetcher } from "@/lib/fetcher";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { formatDateLong } from "@/lib/utils/formatters";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Badge, Button, Card, Icon, Input, Spinner, type IconName } from "@/components/edu";
import { PageHeader } from "@/components/edu-homes/_shared";

type MenuItem = {
    id: string;
    date: string;
    starter?: string;
    mainCourse?: string;
    dessert?: string;
};

type TicketHistoryItem = {
    id: string;
    purchasedAt: string;
    balance: number;
};

type TicketSummary = {
    userId: string;
    userName: string;
    totalBalance: number;
    activeTicket: { qrCode: string; expiresAt: string } | null;
    history: TicketHistoryItem[];
};

export default function CanteenPage() {
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<"menu" | "tickets">("menu");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: ticketSummaries, mutate: mutateTickets } = useSWR<TicketSummary[]>(
        "/api/canteen/tickets",
        fetcher
    );

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        starter: "",
        mainCourse: "",
        dessert: "",
    });

    const fetchMenus = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                "/api/canteen/menu?date=" + new Date().toISOString(),
                { credentials: "include" }
            );
            if (!res.ok) throw new Error("Erreur de chargement des menus");
            const data = await res.json();
            if (data.id) setMenus([data]);
            else if (Array.isArray(data)) setMenus(data);
            else setMenus([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMenus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/canteen/menu", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (!res.ok) throw new Error("Erreur lors de la mise à jour du menu");
            toast.success("Le menu a été mis à jour.");
            setIsDialogOpen(false);
            fetchMenus();
        } catch {
            toast.error("Impossible de mettre à jour le menu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePurchase = async (userId: string) => {
        try {
            const res = await fetch("/api/canteen/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, amount: 10 }),
            });
            if (res.ok) {
                toast.success("Tickets achetés avec succès.");
                mutateTickets();
            }
        } catch {
            toast.error("Échec de l'achat.");
        }
    };

    return (
        <PageGuard
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"]}
        >
            <div className="eduflow-scope flex flex-col gap-4 pb-12">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PageHeader
                        greeting="Cantine & restauration"
                        sub="Menus quotidiens, tickets repas, portefeuille élève"
                        actions={
                            <RoleActionGuard
                                allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}
                            >
                                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button icon="plus">Programmer un menu</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Programmer le menu</DialogTitle>
                                            <DialogDescription>
                                                Saisis les plats pour une date spécifique.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form
                                            onSubmit={handleSubmit}
                                            className="flex flex-col gap-3 py-4"
                                        >
                                            <Input
                                                label="Date"
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, date: e.target.value })
                                                }
                                                icon="calendar"
                                            />
                                            <Input
                                                label="Entrée"
                                                value={formData.starter}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, starter: e.target.value })
                                                }
                                                placeholder="Ex : Salade de crudités"
                                            />
                                            <Input
                                                label="Plat principal"
                                                value={formData.mainCourse}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        mainCourse: e.target.value,
                                                    })
                                                }
                                                placeholder="Ex : Riz sauce tomate et poulet"
                                            />
                                            <Input
                                                label="Dessert"
                                                value={formData.dessert}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        dessert: e.target.value,
                                                    })
                                                }
                                                placeholder="Ex : Fruit de saison"
                                            />
                                            <DialogFooter>
                                                <Button
                                                    type="submit"
                                                    icon={isSubmitting ? undefined : "check"}
                                                    loading={isSubmitting}
                                                    disabled={isSubmitting}
                                                >
                                                    Enregistrer
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </RoleActionGuard>
                        }
                    />
                </div>

                <SegmentedToggle
                    value={view}
                    onChange={setView}
                    options={[
                        { value: "menu", label: "Menu", icon: "book" },
                        { value: "tickets", label: "Tickets & solde", icon: "money" },
                    ]}
                />

                {view === "menu" ? (
                    <div className="flex flex-col gap-4">
                        {loading ? (
                            <Card padding={20}>
                                <div className="flex items-center gap-3">
                                    <Spinner size={18} color="var(--brand-600)" />
                                    <span
                                        style={{
                                            fontSize: 13,
                                            color: "var(--eduflow-text-secondary)",
                                        }}
                                    >
                                        Chargement du menu…
                                    </span>
                                </div>
                            </Card>
                        ) : null}
                        {error ? (
                            <Card
                                padding={14}
                                style={{
                                    borderLeft: "3px solid var(--eduflow-danger-500)",
                                    background: "var(--eduflow-danger-50)",
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        name="warning"
                                        size={18}
                                        color="var(--eduflow-danger-600)"
                                    />
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: 13,
                                            color: "var(--eduflow-danger-800)",
                                        }}
                                    >
                                        {error}
                                    </p>
                                </div>
                            </Card>
                        ) : null}
                        {!loading && !error && menus.length === 0 ? (
                            <Card padding={36}>
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <div
                                        className="grid place-items-center"
                                        style={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: 16,
                                            background: "var(--brand-50)",
                                        }}
                                    >
                                        <Icon name="book" size={26} color="var(--brand-700)" />
                                    </div>
                                    <h3
                                        className="eduflow-display"
                                        style={{ fontSize: 18, margin: 0 }}
                                    >
                                        Aucun menu programmé
                                    </h3>
                                    <p
                                        style={{
                                            fontSize: 13,
                                            color: "var(--eduflow-text-secondary)",
                                            margin: 0,
                                        }}
                                    >
                                        Programme le menu de la semaine pour informer parents et
                                        élèves.
                                    </p>
                                </div>
                            </Card>
                        ) : null}
                        <div
                            className="edu-stagger"
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                                gap: 14,
                            }}
                        >
                            {menus.map((menu) => (
                                <Card key={menu.id} padding={0}>
                                    <div
                                        className="flex items-center gap-2 border-b px-5 py-3"
                                        style={{ borderColor: "var(--eduflow-border-subtle)" }}
                                    >
                                        <Icon name="calendar" size={14} color="var(--brand-700)" />
                                        <h3
                                            style={{
                                                margin: 0,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: "var(--eduflow-text-primary)",
                                                textTransform: "capitalize",
                                            }}
                                        >
                                            {formatDateLong(menu.date)}
                                        </h3>
                                    </div>
                                    <div className="flex flex-col gap-3 px-5 py-4">
                                        {menu.starter ? (
                                            <DishRow
                                                icon="sparkle"
                                                accent="success"
                                                label={menu.starter}
                                                tag="Entrée"
                                            />
                                        ) : null}
                                        {menu.mainCourse ? (
                                            <DishRow
                                                icon="flame"
                                                accent="warning"
                                                label={menu.mainCourse}
                                                tag="Plat"
                                                bold
                                            />
                                        ) : null}
                                        {menu.dessert ? (
                                            <DishRow
                                                icon="sparkle"
                                                accent="brand"
                                                label={menu.dessert}
                                                tag="Dessert"
                                            />
                                        ) : null}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : null}

                {view === "tickets" ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                            gap: 14,
                        }}
                    >
                        {(ticketSummaries || []).map((summary) => (
                            <Card key={summary.userId} padding={0}>
                                <div
                                    className="flex items-center justify-between border-b px-5 py-4"
                                    style={{
                                        borderColor: "var(--eduflow-border-subtle)",
                                        background: "var(--eduflow-surface-sunken)",
                                    }}
                                >
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: "var(--eduflow-text-primary)",
                                            }}
                                        >
                                            {summary.userName}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                letterSpacing: "0.08em",
                                                textTransform: "uppercase",
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 2,
                                            }}
                                        >
                                            Portefeuille repas
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span
                                            className="eduflow-display eduflow-tabular"
                                            style={{
                                                fontSize: 28,
                                                fontWeight: 700,
                                                color: "var(--brand-700)",
                                                lineHeight: 1,
                                            }}
                                        >
                                            {summary.totalBalance}
                                        </span>
                                        <div
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                letterSpacing: "0.08em",
                                                textTransform: "uppercase",
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 2,
                                            }}
                                        >
                                            repas
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 px-5 py-5">
                                    {summary.activeTicket ? (
                                        <div
                                            className="flex flex-col items-center gap-3 p-5 text-center"
                                            style={{
                                                border: "2px dashed var(--eduflow-border-default)",
                                                borderRadius: "var(--eduflow-radius-card)",
                                                background: "var(--eduflow-surface-sunken)",
                                            }}
                                        >
                                            <div
                                                className="grid place-items-center"
                                                style={{
                                                    width: 100,
                                                    height: 100,
                                                    borderRadius: 12,
                                                    background: "white",
                                                    boxShadow: "var(--eduflow-shadow-sm)",
                                                }}
                                            >
                                                <Icon
                                                    name="grid"
                                                    size={68}
                                                    color="var(--eduflow-text-primary)"
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontSize: 9,
                                                        fontWeight: 700,
                                                        letterSpacing: "0.08em",
                                                        textTransform: "uppercase",
                                                        color: "var(--eduflow-text-tertiary)",
                                                    }}
                                                >
                                                    Code de passage unique
                                                </div>
                                                <code
                                                    className="eduflow-mono"
                                                    style={{
                                                        display: "inline-block",
                                                        marginTop: 6,
                                                        padding: "4px 10px",
                                                        background: "var(--eduflow-surface-card)",
                                                        border:
                                                            "1px solid var(--eduflow-border-default)",
                                                        borderRadius: 6,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: "var(--eduflow-text-primary)",
                                                    }}
                                                >
                                                    {summary.activeTicket.qrCode}
                                                </code>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-6 text-center">
                                            <Icon
                                                name="info"
                                                size={28}
                                                color="var(--eduflow-text-tertiary)"
                                            />
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 13,
                                                    color: "var(--eduflow-text-secondary)",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Aucun ticket actif
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <div
                                            style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                letterSpacing: "0.08em",
                                                textTransform: "uppercase",
                                                color: "var(--eduflow-text-tertiary)",
                                                marginBottom: 8,
                                            }}
                                        >
                                            Historique récent
                                        </div>
                                        {summary.history.length === 0 ? (
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: 12,
                                                    fontStyle: "italic",
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                Aucune transaction
                                            </p>
                                        ) : (
                                            <div className="flex flex-col gap-1.5">
                                                {summary.history.slice(0, 5).map((tx) => (
                                                    <div
                                                        key={tx.id}
                                                        className="flex items-center justify-between"
                                                        style={{
                                                            padding: "8px 10px",
                                                            borderRadius: 8,
                                                            background:
                                                                "var(--eduflow-surface-sunken)",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: 500 }}>
                                                            {new Date(tx.purchasedAt).toLocaleDateString(
                                                                "fr-FR"
                                                            )}
                                                        </span>
                                                        <Badge variant="success" size="sm">
                                                            +{tx.balance} repas
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        full
                                        icon="money"
                                        onClick={() => handlePurchase(summary.userId)}
                                    >
                                        Acheter un carnet (10 repas)
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : null}
            </div>
        </PageGuard>
    );
}

function DishRow({
    icon,
    accent,
    label,
    tag,
    bold,
}: {
    icon: IconName;
    accent: "success" | "warning" | "brand" | "info";
    label: string;
    tag: string;
    bold?: boolean;
}) {
    const bg =
        accent === "brand" ? "var(--brand-50)" : `var(--eduflow-${accent}-50)`;
    const fg =
        accent === "brand" ? "var(--brand-700)" : `var(--eduflow-${accent}-700)`;
    return (
        <div className="flex items-center gap-3">
            <div
                className="grid place-items-center"
                style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: bg,
                    color: fg,
                    flexShrink: 0,
                }}
            >
                <Icon name={icon} size={14} />
            </div>
            <div className="min-w-0 flex-1">
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: bold ? 700 : 500,
                        color: "var(--eduflow-text-primary)",
                        lineHeight: 1.4,
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--eduflow-text-tertiary)",
                        marginTop: 2,
                    }}
                >
                    {tag}
                </div>
            </div>
        </div>
    );
}

function SegmentedToggle<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T;
    onChange: (v: T) => void;
    options: { value: T; label: string; icon: IconName }[];
}) {
    return (
        <div
            className="flex w-fit gap-1 rounded-md p-1"
            style={{
                background: "var(--eduflow-surface-sunken)",
                border: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                            background: active ? "var(--eduflow-surface-card)" : "transparent",
                            border: 0,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            color: active
                                ? "var(--brand-700)"
                                : "var(--eduflow-text-secondary)",
                            boxShadow: active ? "var(--eduflow-shadow-sm)" : "none",
                            transition:
                                "all var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                        }}
                    >
                        <Icon name={opt.icon} size={13} />
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
