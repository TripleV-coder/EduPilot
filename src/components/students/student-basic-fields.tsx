"use client";

import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Control } from "react-hook-form";

interface StudentBasicFieldsProps {
    control: Control<any>;
    showDescriptions?: boolean;
}

export function StudentIdentityFields({ control, showDescriptions = false }: StudentBasicFieldsProps) {
    return (
        <>
            <FormField
                control={control}
                name="matricule"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Matricule {showDescriptions && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        {showDescriptions && (
                            <FormDescription className="text-xs">
                                Identifiant interne unique de l'élève dans votre établissement.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="gender"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Genre {showDescriptions && <span className="text-destructive">*</span>}</FormLabel>
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
            <FormField
                control={control}
                name="firstName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Prénoms {showDescriptions && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        {showDescriptions && (
                            <FormDescription className="text-xs">
                                Prénoms officiels tels qu'ils apparaissent sur les documents scolaires.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="lastName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nom de famille {showDescriptions && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        {showDescriptions && (
                            <FormDescription className="text-xs">
                                Nom de famille principal de l'élève.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}

export function StudentContactFields({ control, showDescriptions = false }: StudentBasicFieldsProps) {
    return (
        <>
            <FormField
                control={control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email {showDescriptions && <span className="text-destructive">*</span>}</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        {showDescriptions && (
                            <FormDescription className="text-xs">
                                Adresse email utilisée pour la connexion élève et les notifications.
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="phone"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl><Input type="tel" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={control}
                name="address"
                render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Adresse</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </>
    );
}
