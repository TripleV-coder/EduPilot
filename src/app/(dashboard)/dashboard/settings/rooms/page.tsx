"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError, PageEmpty } from "@/components/layout/page-states";
import { Card, CardContent } from "@/components/ui/card";
import {
    Building2,
    Plus,
    Users,
    Monitor,
    MapPin,
    Trash2,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Pencil,
    GraduationCap,
    AlertCircle,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { fetcher } from "@/lib/fetcher";

const ROOM_CATEGORY = "room";

type Room = {
    id: string;
    name: string;
    capacity: number;
    type: string;
    building: string;
    features: string[];
};

type RoomFormData = {
    name: string;
    capacity: string;
    type: string;
    building: string;
    features: string;
};

type ConfigOption = {
    id: string;
    code: string;
    label: string;
    description: string | null;
    category: string;
    order: number;
    isActive: boolean;
    metadata: {
        capacity?: number;
        type?: string;
        building?: string;
        features?: string[];
    } | null;
};

const ROOM_TYPES = ["Standard", "Laboratoire", "Informatique", "Amphithéâtre"] as const;

const EMPTY_FORM: RoomFormData = {
    name: "",
    capacity: "",
    type: "Standard",
    building: "",
    features: "",
};

function slugifyCode(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 50);
}

function configToRoom(opt: ConfigOption): Room {
    const m = opt.metadata ?? {};
    return {
        id: opt.id,
        name: opt.label,
        capacity: typeof m.capacity === "number" ? m.capacity : 0,
        type: typeof m.type === "string" ? m.type : "Standard",
        building: typeof m.building === "string" ? m.building : "",
        features: Array.isArray(m.features) ? m.features : [],
    };
}

function getRoomIcon(type: string) {
    switch (type) {
        case "Informatique":
            return <Monitor className="w-5 h-5 text-secondary" />;
        case "Amphithéâtre":
            return <GraduationCap className="w-5 h-5 text-primary" />;
        case "Laboratoire":
            return <Building2 className="w-5 h-5 text-accent" />;
        default:
            return <Building2 className="w-5 h-5 text-muted-foreground" />;
    }
}

function getRoomBadgeClass(type: string) {
    switch (type) {
        case "Laboratoire":
            return "text-accent bg-accent/10 border-accent/20";
        case "Informatique":
            return "text-secondary bg-secondary/10 border-secondary/20";
        case "Amphithéâtre":
            return "text-primary bg-primary/10 border-primary/20";
        default:
            return "text-muted-foreground bg-muted/30 border-border";
    }
}

function AddRoomForm({
    open,
    onToggle,
    onAdd,
    busy,
}: {
    open: boolean;
    onToggle: () => void;
    onAdd: (form: RoomFormData) => Promise<void>;
    busy: boolean;
}) {
    const [form, setForm] = useState<RoomFormData>({ ...EMPTY_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof RoomFormData, string>>>({});

    const resetForm = () => {
        setForm({ ...EMPTY_FORM });
        setErrors({});
    };

    const validate = (): boolean => {
        const next: Partial<Record<keyof RoomFormData, string>> = {};
        if (!form.name.trim()) next.name = "Le nom est requis";
        if (!form.capacity.trim() || isNaN(Number(form.capacity)) || Number(form.capacity) <= 0)
            next.capacity = "La capacité doit être un nombre positif";
        if (!form.type) next.type = "Le type est requis";
        if (!form.building.trim()) next.building = "Le bâtiment est requis";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        await onAdd(form);
        resetForm();
    };

    return (
        <Card className="border-border shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Ajouter une nouvelle salle</span>
                </div>
                {open ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
            </button>

            {open && (
                <CardContent className="px-5 pb-5 pt-0 border-t border-border">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="add-name">Nom de la salle *</Label>
                            <Input
                                id="add-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className={errors.name ? "border-destructive" : ""}
                            />
                            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add-capacity">Capacité *</Label>
                            <Input
                                id="add-capacity"
                                type="number"
                                min={1}
                                value={form.capacity}
                                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                                className={errors.capacity ? "border-destructive" : ""}
                            />
                            {errors.capacity && <p className="text-xs text-destructive">{errors.capacity}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Type *</Label>
                            <Select
                                value={form.type}
                                onValueChange={(val) => setForm({ ...form, type: val })}
                            >
                                <SelectTrigger className={errors.type ? "border-destructive" : ""}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROOM_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="add-building">Bâtiment *</Label>
                            <Input
                                id="add-building"
                                value={form.building}
                                onChange={(e) => setForm({ ...form, building: e.target.value })}
                                className={errors.building ? "border-destructive" : ""}
                            />
                            {errors.building && <p className="text-xs text-destructive">{errors.building}</p>}
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="add-features">Équipements (séparés par des virgules)</Label>
                            <Input
                                id="add-features"
                                value={form.features}
                                onChange={(e) => setForm({ ...form, features: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                resetForm();
                                onToggle();
                            }}
                            disabled={busy}
                        >
                            Annuler
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            className="gap-1.5"
                            disabled={busy}
                        >
                            {busy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Plus className="w-3.5 h-3.5" />
                            )}
                            Ajouter
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function EditRoomDialog({
    room,
    open,
    onOpenChange,
    onSave,
    busy,
}: {
    room: Room | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (room: Room, form: RoomFormData) => Promise<void>;
    busy: boolean;
}) {
    const [form, setForm] = useState<RoomFormData>({ ...EMPTY_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof RoomFormData, string>>>({});

    useEffect(() => {
        if (room && open) {
             
            setForm({
                name: room.name,
                capacity: String(room.capacity),
                type: room.type,
                building: room.building,
                features: room.features.join(", "),
            });
            setErrors({});
        }
    }, [room, open]);

    const validate = (): boolean => {
        const next: Partial<Record<keyof RoomFormData, string>> = {};
        if (!form.name.trim()) next.name = "Le nom est requis";
        if (!form.capacity.trim() || isNaN(Number(form.capacity)) || Number(form.capacity) <= 0)
            next.capacity = "La capacité doit être un nombre positif";
        if (!form.type) next.type = "Le type est requis";
        if (!form.building.trim()) next.building = "Le bâtiment est requis";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async () => {
        if (!room || !validate()) return;
        await onSave(room, form);
        onOpenChange(false);
    };

    if (!room) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-4 h-4" />
                        Modifier la salle
                    </DialogTitle>
                    <DialogDescription>
                        Modifiez les informations de la salle puis enregistrez vos changements.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">Nom *</Label>
                        <Input
                            id="edit-name"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className={errors.name ? "border-destructive" : ""}
                        />
                        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="edit-capacity">Capacité *</Label>
                        <Input
                            id="edit-capacity"
                            type="number"
                            min={1}
                            value={form.capacity}
                            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                            className={errors.capacity ? "border-destructive" : ""}
                        />
                        {errors.capacity && <p className="text-xs text-destructive">{errors.capacity}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label>Type *</Label>
                        <Select
                            value={form.type}
                            onValueChange={(val) => setForm({ ...form, type: val })}
                        >
                            <SelectTrigger className={errors.type ? "border-destructive" : ""}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ROOM_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="edit-building">Bâtiment *</Label>
                        <Input
                            id="edit-building"
                            value={form.building}
                            onChange={(e) => setForm({ ...form, building: e.target.value })}
                            className={errors.building ? "border-destructive" : ""}
                        />
                        {errors.building && <p className="text-xs text-destructive">{errors.building}</p>}
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="edit-features">Équipements (séparés par des virgules)</Label>
                        <Input
                            id="edit-features"
                            value={form.features}
                            onChange={(e) => setForm({ ...form, features: e.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={busy}
                    >
                        Annuler
                    </Button>
                    <Button onClick={handleSave} className="gap-1.5" disabled={busy}>
                        {busy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Enregistrer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function RoomsPage() {
    const { data, error, isLoading, mutate } = useSWR<ConfigOption[]>(
        `/api/config-options?category=${ROOM_CATEGORY}&activeOnly=false`,
        fetcher
    );

    const rooms: Room[] = useMemo(() => (data ?? []).map(configToRoom), [data]);

    const [search, setSearch] = useState("");
    const [saved, setSaved] = useState(false);
    const [addFormOpen, setAddFormOpen] = useState(false);
    const [editRoom, setEditRoom] = useState<Room | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const flashSaved = useCallback(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }, []);

    const buildPayload = (form: RoomFormData) => ({
        category: ROOM_CATEGORY,
        code: slugifyCode(form.name) || `room-${Date.now()}`,
        label: form.name.trim(),
        metadata: {
            capacity: Number(form.capacity),
            type: form.type,
            building: form.building.trim(),
            features: form.features
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean),
        },
    });

    const handleAdd = async (form: RoomFormData) => {
        setBusy(true);
        setApiError(null);
        try {
            const res = await fetch("/api/config-options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(form)),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Erreur lors de la création");
            }
            await mutate();
            flashSaved();
            setAddFormOpen(false);
        } catch (err) {
            setApiError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setBusy(false);
        }
    };

    const handleEdit = async (room: Room, form: RoomFormData) => {
        setBusy(true);
        setApiError(null);
        try {
            const res = await fetch(`/api/config-options/${room.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(form)),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Erreur lors de la mise à jour");
            }
            await mutate();
            flashSaved();
        } catch (err) {
            setApiError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (id: string) => {
        setBusy(true);
        setApiError(null);
        try {
            const res = await fetch(`/api/config-options/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Erreur lors de la suppression");
            }
            await mutate();
            flashSaved();
        } catch (err) {
            setApiError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setBusy(false);
        }
    };

    const openEditDialog = (room: Room) => {
        setEditRoom(room);
        setEditDialogOpen(true);
    };

    const filteredRooms = rooms.filter(
        (r) =>
            !search ||
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.building.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <PageGuard roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"]}>
            <PageShell>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Salles de classe"
                        description="Gestion des salles physiques de l'établissement, partagées par tous les utilisateurs."
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Paramètres", href: "/dashboard/settings" },
                            { label: "Salles" },
                        ]}
                    />
                    <div className="flex items-center gap-3">
                        <Button
                            className="gap-2 shadow-sm"
                            onClick={() => setAddFormOpen((prev) => !prev)}
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter une salle
                        </Button>
                    </div>
                </div>

                {saved && (
                    <div className="p-3 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4" /> Modifications enregistrées.
                    </div>
                )}

                {(error || apiError) && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4" />{" "}
                        {apiError || "Impossible de charger les salles."}
                    </div>
                )}

                <AddRoomForm
                    open={addFormOpen}
                    onToggle={() => setAddFormOpen((prev) => !prev)}
                    onAdd={handleAdd}
                    busy={busy}
                />

                <div className="flex gap-4">
                    <Input
                        placeholder="Rechercher une salle ou un bâtiment…"
                        className="max-w-xs bg-background"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredRooms.map((room) => (
                            <Card
                                key={room.id}
                                className="border-border shadow-sm hover:shadow-md transition-shadow"
                            >
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-muted rounded-lg">
                                            {getRoomIcon(room.type)}
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={getRoomBadgeClass(room.type)}
                                        >
                                            {room.type}
                                        </Badge>
                                    </div>

                                    <h3 className="font-bold text-lg text-foreground">
                                        {room.name}
                                    </h3>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1 mb-4">
                                        <MapPin className="w-3.5 h-3.5" /> {room.building}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Capacité</span>
                                            <span className="font-semibold flex items-center gap-1">
                                                <Users className="w-4 h-4" /> {room.capacity} places
                                            </span>
                                        </div>

                                        {room.features.length > 0 && (
                                            <div className="pt-3 border-t border-border">
                                                <p className="text-xs text-muted-foreground mb-2 font-medium">
                                                    Équipements
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {room.features.map((f) => (
                                                        <span
                                                            key={f}
                                                            className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border"
                                                        >
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-5 flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="w-full h-8 text-xs"
                                            onClick={() => openEditDialog(room)}
                                            disabled={busy}
                                        >
                                            Modifier
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-8 text-xs text-destructive hover:text-destructive shrink-0"
                                            onClick={() => handleDelete(room.id)}
                                            disabled={busy}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        <Card
                            className="border-border border-dashed shadow-none hover:bg-muted/5 transition-colors cursor-pointer bg-muted/10"
                            onClick={() => setAddFormOpen(true)}
                        >
                            <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[250px] text-center">
                                <div className="p-3 bg-background rounded-full mb-3 shadow-sm border border-border">
                                    <Plus className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <h3 className="font-medium text-foreground">Nouvelle Salle</h3>
                                <p className="text-sm text-muted-foreground mt-1 px-4">
                                    Créer un nouvel espace d&apos;apprentissage
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </PageShell>

            <EditRoomDialog
                room={editRoom}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleEdit}
                busy={busy}
            />
        </PageGuard>
    );
}
