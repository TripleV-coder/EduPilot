"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ImportPreviewProps {
    data: any[];
    validationErrors: Record<number, string[]>;
}

export function ImportPreview({ data, validationErrors }: ImportPreviewProps) {
    if (!data || data.length === 0) return null;

    const headers = Object.keys(data[0]);
    const hasErrors = Object.keys(validationErrors).length > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Aperçu des données ({data.length} lignes)</h3>
                <div className="flex gap-2">
                    <Badge variant="outline" className="gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        {data.length - Object.keys(validationErrors).length} Valides
                    </Badge>
                    {hasErrors && (
                        <Badge variant="outline" className="gap-1 text-destructive border-destructive/20 bg-destructive/5">
                            <AlertCircle className="w-3 h-3" />
                            {Object.keys(validationErrors).length} Erreurs
                        </Badge>
                    )}
                </div>
            </div>

            <div className="rounded-md border bg-background">
                <ScrollArea className="h-[400px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[50px]">#</TableHead>
                                <TableHead className="w-[100px]">Statut</TableHead>
                                {headers.map((header) => (
                                    <TableHead key={header} className="min-w-[150px]">{header}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row, index) => {
                                const errors = validationErrors[index];
                                const isValid = !errors;

                                return (
                                    <TableRow key={index} className={!isValid ? "bg-red-50/50 dark:bg-red-900/10" : ""}>
                                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell>
                                            {isValid ? (
                                                <Badge variant="success" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Valide</Badge>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="destructive" className="w-fit">Erreur</Badge>
                                                    <span className="text-[10px] text-destructive font-medium leading-tight">
                                                        {errors[0]}
                                                    </span>
                                                </div>
                                            )}
                                        </TableCell>
                                        {headers.map((header) => (
                                            <TableCell key={`${index}-${header}`} className="whitespace-nowrap">
                                                {row[header]}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
}
