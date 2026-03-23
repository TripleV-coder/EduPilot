"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { studentUpdateSchema } from "@/lib/validations/user";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface StudentEditDialogProps {
    student: any;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function StudentEditDialog({ student, open, onOpenChange, onSuccess }: StudentEditDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof studentUpdateSchema>>({
        resolver: zodResolver(studentUpdateSchema) as any,
        defaultValues: {
            firstName: student?.user?.firstName || "",
            lastName: student?.user?.lastName || "",
            email: student?.user?.email || "",
            phone: student?.user?.phone || "",
            matricule: student?.studentNumber || student?.matricule || "",
            gender: student?.gender || "MALE",
            nationality: student?.nationality || "Beninoise",
            address: student?.address || "",
            isActive: student?.user?.isActive ?? true,
        },
    });

    async function onSubmit(values: z.infer<typeof studentUpdateSchema>) {
        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/students/${student.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Erreur lors de la mise à jour");
            }

            toast({ title: "Succès", description: "Le profil de l'élève a été mis à jour." });
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Modifier le profil de l&apos;élève</DialogTitle>
                    <DialogDescription>
                        Mettez à jour les informations personnelles et le statut de l&apos;élève.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prénom</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nom</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl><Input type="email" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Téléphone</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="matricule"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Matricule</FormLabel>
                                        <FormControl><Input {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Genre</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="MALE">Masculin</SelectItem>
                                                <SelectItem value="FEMALE">Féminin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adresse</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Statut Actif</FormLabel>
                                        <div className="text-xs text-muted-foreground">
                                            Désactiver si l&apos;élève a quitté l&apos;établissement.
                                        </div>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Enregistrer les modifications
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
