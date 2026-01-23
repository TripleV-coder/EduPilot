"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColumnMapperProps {
    headers: string[];
    requiredFields: { key: string; label: string; required: boolean }[];
    onMappingComplete: (mapping: Record<string, string>) => void;
    initialMapping?: Record<string, string>;
}

export function ColumnMapper({ headers, requiredFields, onMappingComplete, initialMapping = {} }: ColumnMapperProps) {
    const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

    // Auto-map based on similar names
    useEffect(() => {
        const newMapping = { ...initialMapping };
        if (Object.keys(newMapping).length === 0) {
            requiredFields.forEach((field) => {
                const match = headers.find(h =>
                    h.toLowerCase().includes(field.label.toLowerCase()) ||
                    h.toLowerCase() === field.key.toLowerCase()
                );
                if (match) {
                    newMapping[field.key] = match;
                }
            });
            setMapping(newMapping);
            onMappingComplete(newMapping);
        }
    }, [headers, requiredFields, initialMapping, onMappingComplete]);

    const handleMap = (fieldKey: string, header: string) => {
        const newMapping = { ...mapping, [fieldKey]: header };
        setMapping(newMapping);
        onMappingComplete(newMapping);
    };

    const isMapped = (fieldKey: string) => !!mapping[fieldKey];
    const allRequiredMapped = requiredFields.filter(f => f.required).every(f => isMapped(f.key));

    return (
        <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {requiredFields.map((field) => {
                    const mappedHeader = mapping[field.key];
                    const isSet = !!mappedHeader;

                    return (
                        <Card key={field.key} className={cn("transition-all duration-200", isSet ? "border-apogee-emerald/40 bg-apogee-emerald/10" : field.required ? "border-apogee-gold/40" : "")}>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-medium flex items-center justify-between">
                                    {field.label}
                                    {field.required && <span className="text-xs text-apogee-gold font-normal">Requis</span>}
                                    {isSet && <Check className="w-4 h-4 text-apogee-emerald" />}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                                <Select value={mappedHeader} onValueChange={(val) => handleMap(field.key, val)}>
                                    <SelectTrigger className={cn("w-full transition-colors", isSet && "border-apogee-emerald/40")}>
                                        <SelectValue placeholder="Sélectionner une colonne..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {headers.map((header) => (
                                            <SelectItem key={header} value={header}>
                                                {header}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {!allRequiredMapped && (
                <div className="rounded-lg border border-apogee-gold/30 bg-apogee-gold/10 p-4 text-apogee-gold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">Veuillez mapper tous les champs requis pour continuer.</p>
                </div>
            )}
        </div>
    );
}
