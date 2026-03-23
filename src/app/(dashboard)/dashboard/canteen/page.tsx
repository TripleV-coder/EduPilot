"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils, AlertCircle, Calendar, Plus, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

type MenuItem = {
    id: string;
    date: string;
    starter?: string;
    mainCourse?: string;
    dessert?: string;
};

export default function CanteenPage() {
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

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
            // Since the API might return a single menu or a message, we handle it
            if (data.id) {
                setMenus([data]);
            } else if (Array.isArray(data)) {
                setMenus(data);
            } else {
                setMenus([]);
            }
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

            toast({ title: "Succès", description: "Le menu a été mis à jour." });
            setIsDialogOpen(false);
            fetchMenus();
        } catch (err) {
            toast({ title: "Erreur", description: "Impossible de mettre à jour le menu.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (d: string) =>
        new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(d));

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "PARENT", "STUDENT"]}>
            <div className="space-y-6">
                <PageHeader
                    title="Cantine"
                    description="Gestion des menus et tickets repas"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Cantine" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
                                        <Plus className="w-4 h-4" /> Programmer un menu
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Programmer le menu</DialogTitle>
                                        <DialogDescription>
                                            Saisissez les plats pour une date spécifique.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="date">Date</Label>
                                            <Input
                                                id="date"
                                                type="date"
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="starter">Entrée</Label>
                                            <Input
                                                id="starter"
                                                
                                                value={formData.starter}
                                                onChange={(e) => setFormData({ ...formData, starter: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="main">Plat principal</Label>
                                            <Input
                                                id="main"
                                                
                                                value={formData.mainCourse}
                                                onChange={(e) => setFormData({ ...formData, mainCourse: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dessert">Dessert</Label>
                                            <Input
                                                id="dessert"
                                                
                                                value={formData.dessert}
                                                onChange={(e) => setFormData({ ...formData, dessert: e.target.value })}
                                            />
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

                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                )}

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && menus.length === 0 && (
                    <div className="text-center py-16 border border-dashed border-border rounded-xl bg-muted/30">
                        <Utensils className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-foreground">Aucun menu programmé</h3>
                        <p className="text-sm text-muted-foreground mt-2">Les menus de la cantine apparaîtront ici.</p>
                    </div>
                )}

                {!loading && !error && menus.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {menus.map((menu) => (
                            <Card key={menu.id} className="border-border bg-card">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-primary" />
                                        {formatDate(menu.date)}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-1 text-sm text-muted-foreground">
                                    {menu.starter && <p>🥗 {menu.starter}</p>}
                                    {menu.mainCourse && <p>🍽️ {menu.mainCourse}</p>}
                                    {menu.dessert && <p>🍰 {menu.dessert}</p>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </PageGuard>
    );
}
