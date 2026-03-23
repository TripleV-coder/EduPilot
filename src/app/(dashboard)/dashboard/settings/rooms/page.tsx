"use client";

import { useState, useEffect, useCallback } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
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
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

 

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

const STORAGE_KEY = "edupilot-rooms";

const ROOM_TYPES = ["Standard", "Laboratoire", "Informatique", "Amphithéâtre"] as const;

const DEFAULT_ROOMS: Room[] = [
    { id: "1", name: "Salle A01", capacity: 45, type: "Standard", building: "Bâtiment A", features: ["Projecteur", "Tableau Blanc"] },
    { id: "2", name: "Salle A02", capacity: 40, type: "Standard", building: "Bâtiment A", features: ["Tableau Blanc"] },
    { id: "3", name: "Laboratoire B1", capacity: 25, type: "Laboratoire", building: "Bâtiment B", features: ["Paillasses", "Gaz", "Écran"] },
    { id: "4", name: "Salle Info 1", capacity: 30, type: "Informatique", building: "Bâtiment C", features: ["30 PCs", "Projecteur", "Climatisation"] },
];

const EMPTY_FORM: RoomFormData = {
    name: "",
    capacity: "",
    type: "Standard",
    building: "",
    features: "",
};

function loadRooms(profilePrefs: any): Room[] {
    if (profilePrefs?.rooms) {
        return profilePrefs.rooms;
    }
    if (typeof window === "undefined") return DEFAULT_ROOMS;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try { return JSON.parse(stored); } catch { /* ignore */ }
    }
    return DEFAULT_ROOMS;
}

async function saveRooms(rooms: Room[], profileData: any, mutate: any) {
    try {
        const currentPrefs = profileData?.preferences || {};
        const updatedPrefs = { ...currentPrefs, rooms };

        await fetch("/api/user/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preferences: updatedPrefs }),
        });

        mutate({ ...profileData, preferences: updatedPrefs }, false);
    } catch (error) {
        console.error("Failed to save rooms:", error);
        // Fallback to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    }
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

// ---------------------------------------------------------------------------
// Inline Add Form (collapsible, at the top of the page)
// ---------------------------------------------------------------------------
function AddRoomForm({
    open,
    onToggle,
    onAdd,
}: {
    open: boolean;
    onToggle: () => void;
    onAdd: (room: Room) => void;
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

    const handleSubmit = () => {
        if (!validate()) return;
        const newRoom: Room = {
            id: crypto.randomUUID(),
            name: form.name.trim(),
            capacity: Number(form.capacity),
            type: form.type,
            building: form.building.trim(),
            features: form.features
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean),
        };
        onAdd(newRoom);
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
                        {/* Name */}
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

                        {/* Capacity */}
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

                        {/* Type */}
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

                        {/* Building */}
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

                        {/* Features */}
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
                        >
                            Annuler
                        </Button>
                        <Button size="sm" onClick={handleSubmit} className="gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            Ajouter
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Edit Room Dialog
// ---------------------------------------------------------------------------
function EditRoomDialog({
    room,
    open,
    onOpenChange,
    onSave,
}: {
    room: Room | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updated: Room) => void;
}) {
    const [form, setForm] = useState<RoomFormData>({ ...EMPTY_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof RoomFormData, string>>>({});

    // Sync form state when the dialog opens with a room
    useEffect(() => {
        if (room && open) {
            queueMicrotask(() => {
                setForm({
                    name: room.name,
                    capacity: String(room.capacity),
                    type: room.type,
                    building: room.building,
                    features: room.features.join(", "),
                });
                setErrors({});
            });
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

    const handleSave = () => {
        if (!room || !validate()) return;
        onSave({
            id: room.id,
            name: form.name.trim(),
            capacity: Number(form.capacity),
            type: form.type,
            building: form.building.trim(),
            features: form.features
                .split(",")
                .map((f) => f.trim())
                .filter(Boolean),
        });
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
                    {/* Name */}
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

                    {/* Capacity */}
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

                    {/* Type */}
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

                    {/* Building */}
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

                    {/* Features */}
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annuler
                    </Button>
                    <Button onClick={handleSave} className="gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Enregistrer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function RoomsPage() {
    const { data: profileData, mutate } = useSWR("/api/user/profile", fetcher);

    const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
    const [search, setSearch] = useState("");
    const [saved, setSaved] = useState(false);
    const [addFormOpen, setAddFormOpen] = useState(false);
    const [editRoom, setEditRoom] = useState<Room | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    useEffect(() => {
        queueMicrotask(() => setRooms(loadRooms(profileData?.preferences)));
    }, [profileData]);

    // Show a transient success message
    const flashSaved = useCallback(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }, []);

    // -- CRUD ----------------------------------------------------------------

    const handleAdd = (room: Room) => {
        const updated = [...rooms, room];
        setRooms(updated);
        saveRooms(updated, profileData, mutate);
        flashSaved();
    };

    const handleEdit = (updated: Room) => {
        const next = rooms.map((r) => (r.id === updated.id ? updated : r));
        setRooms(next);
        saveRooms(next, profileData, mutate);
        flashSaved();
    };

    const handleDelete = (id: string) => {
        const updated = rooms.filter((r) => r.id !== id);
        setRooms(updated);
        saveRooms(updated, profileData, mutate);
        flashSaved();
    };

    const openEditDialog = (room: Room) => {
        setEditRoom(room);
        setEditDialogOpen(true);
    };

    // -- Filter --------------------------------------------------------------

    const filteredRooms = rooms.filter(
        (r) =>
            !search ||
            r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.building.toLowerCase().includes(search.toLowerCase())
    );

    // -- Render --------------------------------------------------------------

    return (
        <PageGuard permission={["*" as Permission]}>
            <div className="space-y-6 max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <PageHeader
                        title="Salles de classe"
                        description="Gestion des salles physiques, de leurs capacités et de leurs équipements"
                        breadcrumbs={[
                            { label: "Tableau de bord", href: "/dashboard" },
                            { label: "Paramètres" },
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

                {/* Success toast */}
                {saved && (
                    <div className="p-3 rounded-lg bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success))] flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4" /> Modifications enregistrées.
                    </div>
                )}

                {/* Inline Add Form (collapsible) */}
                <AddRoomForm
                    open={addFormOpen}
                    onToggle={() => setAddFormOpen((prev) => !prev)}
                    onAdd={handleAdd}
                />

                {/* Search */}
                <div className="flex gap-4">
                    <Input
                        
                        className="max-w-xs bg-background"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Room Cards Grid */}
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

                                <h3 className="font-bold text-lg text-foreground">{room.name}</h3>
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
                                </div>

                                <div className="mt-5 flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="w-full h-8 text-xs"
                                        onClick={() => openEditDialog(room)}
                                    >
                                        Modifier
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-8 text-xs text-destructive hover:text-destructive shrink-0"
                                        onClick={() => handleDelete(room.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {/* New Room Card Skeleton */}
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
            </div>

            {/* Edit Dialog */}
            <EditRoomDialog
                room={editRoom}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleEdit}
            />
        </PageGuard>
    );
}
