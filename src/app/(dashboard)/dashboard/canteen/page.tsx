"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Utensils, AlertCircle, Calendar, Plus, Loader2, QrCode, History, Wallet, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

type MenuItem = {
    id: string;
    date: string;
    starter?: string;
    mainCourse?: string;
    dessert?: string;
};

type TicketSummary = {
    userId: string;
    userName: string;
    totalBalance: number;
    activeTicket: {
        qrCode: string;
        expiresAt: string;
    } | null;
    history: any[];
};

export default function CanteenPage() {
    const { data: session } = useSession();
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tickets data
    const { data: ticketSummaries, mutate: mutateTickets } = useSWR<TicketSummary[]>("/api/canteen/tickets", fetcher);

    // Form state
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        starter: "",
        mainCourse: "",
        dessert: ""
    });

    const fetchMenus = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/canteen/menu?date=" + new Date().toISOString(), { credentials: "include" });
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
        } catch (err) {
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

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(d));

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Cantine & Restauration"
                    description="Suivi des menus quotidiens et gestion des tickets repas."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Cantine" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2 action-critical">
                                        <Plus className="w-4 h-4" /> Programmer un menu
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Programmer le menu</DialogTitle>
                                        <DialogDescription>Saisissez les plats pour une date spécifique.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="date">Date</Label>
                                            <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="starter">Entrée</Label>
                                            <Input id="starter" value={formData.starter} onChange={(e) => setFormData({ ...formData, starter: e.target.value })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="main">Plat principal</Label>
                                            <Input id="main" value={formData.mainCourse} onChange={(e) => setFormData({ ...formData, mainCourse: e.target.value })} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dessert">Dessert</Label>
                                            <Input id="dessert" value={formData.dessert} onChange={(e) => setFormData({ ...formData, dessert: e.target.value })} />
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                                Enregistrer le menu
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </RoleActionGuard>
                    }
                />

                <Tabs defaultValue="menu" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1">
                        <TabsTrigger value="menu" className="gap-2">
                            <Utensils className="w-4 h-4" /> Menu de la Semaine
                        </TabsTrigger>
                        <TabsTrigger value="tickets" className="gap-2">
                            <Wallet className="w-4 h-4" /> Mes Tickets & Solde
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="menu" className="space-y-6">
                        {loading && <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}
                        {error && <div className="p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>}
                        {!loading && !error && menus.length === 0 && (
                            <div className="text-center py-16 border border-dashed rounded-xl bg-muted/30">
                                <Utensils className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-medium">Aucun menu programmé</h3>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {menus.map((menu) => (
                                <Card key={menu.id} className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            {formatDate(menu.date)}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 pt-2">
                                        {menu.starter && <div className="flex items-center gap-3 text-sm"><span className="w-8 h-8 rounded bg-emerald-50 flex items-center justify-center text-emerald-600">🥗</span> {menu.starter}</div>}
                                        {menu.mainCourse && <div className="flex items-center gap-3 text-sm font-semibold"><span className="w-8 h-8 rounded bg-amber-50 flex items-center justify-center text-amber-600">🍽️</span> {menu.mainCourse}</div>}
                                        {menu.dessert && <div className="flex items-center gap-3 text-sm"><span className="w-8 h-8 rounded bg-pink-50 flex items-center justify-center text-pink-600">🍰</span> {menu.dessert}</div>}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="tickets" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {(ticketSummaries || []).map(summary => (
                                <Card key={summary.userId} className="border-border overflow-hidden">
                                    <CardHeader className="bg-muted/30 border-b">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle className="text-sm font-bold">{summary.userName}</CardTitle>
                                                <CardDescription className="text-[10px] uppercase font-black">Portefeuille Repas</CardDescription>
                                            </div>
                                            <Badge variant="secondary" className="text-lg font-black px-3 py-1">
                                                {summary.totalBalance} <span className="text-[10px] ml-1 uppercase opacity-60">repas</span>
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        {summary.activeTicket ? (
                                            <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-2xl bg-muted/5">
                                                <div className="w-32 h-32 bg-white p-2 rounded-lg shadow-inner mb-4 flex items-center justify-center">
                                                    <QrCode className="w-24 h-24 text-slate-900" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Code de passage unique</p>
                                                <code className="text-xs font-mono font-bold bg-muted px-2 py-1 rounded">{summary.activeTicket.qrCode}</code>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                                <p className="text-sm font-medium text-muted-foreground">Aucun ticket actif</p>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                <History className="w-3 h-3" /> Historique récent
                                            </h4>
                                            <div className="space-y-2">
                                                {summary.history.length === 0 ? (
                                                    <p className="text-xs italic text-muted-foreground">Aucune transaction</p>
                                                ) : summary.history.map((t: any) => (
                                                    <div key={t.id} className="flex justify-between items-center text-xs p-2 rounded bg-muted/30">
                                                        <span className="font-medium">{new Date(t.purchasedAt).toLocaleDateString()}</span>
                                                        <Badge variant="outline" className="text-[9px] font-bold">+{t.balance} REPAS</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <Button 
                                            className="w-full gap-2 font-bold uppercase tracking-tighter shadow-sm" 
                                            onClick={() => handlePurchase(summary.userId)}
                                        >
                                            <ShoppingCart className="w-4 h-4" /> Acheter un carnet (10 repas)
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </PageGuard>
    );
}
