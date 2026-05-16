"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebtAgingChart } from "@/components/charts/DebtAgingChart";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { FR_TOOLTIP_STYLE } from "@/components/charts/chart-theme";

interface FinanceAnalyticsTabProps {
    data: any;
}

export function FinanceAnalyticsTab({ data }: FinanceAnalyticsTabProps) {
    const monthlyRevenue = useMemo<Array<{ month: string; received: number }>>(() => {
        if (!data?.revenueByMonth) return [];
        return data.revenueByMonth.map((m: { month: string; amount?: number | string }) => ({
            month: m.month,
            received: Number(m.amount || 0),
        }));
    }, [data]);

    const composedData = useMemo(() => {
        const result: Array<{ month: string; received: number; cumulative: number }> = [];
        for (const entry of monthlyRevenue) {
            const previous = result[result.length - 1]?.cumulative || 0;
            result.push({
                month: entry.month,
                received: entry.received,
                cumulative: previous + entry.received,
            });
        }
        return result;
    }, [monthlyRevenue]);

    const agingData = Array.isArray(data?.debtAgingBuckets) ? data.debtAgingBuckets : [];
    const totalRevenue = Number(data?.totalRevenue || 0);
    const totalPending = Number(data?.totalPending || 0);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="dashboard-block border-border" data-reveal>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center justify-between">
                            Encaissements mensuels
                            <Badge variant="outline" className="text-[9px]">Mensuel</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={composedData}>
                                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                                <Tooltip {...FR_TOOLTIP_STYLE} />
                                <Legend />
                                <Bar yAxisId="left" name="Reçu" dataKey="received" fill="hsl(var(--primary))" />
                                <Line yAxisId="right" name="Cumulé" type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="dashboard-block border-border" data-reveal>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center justify-between">
                            Ancienneté des Créances
                            <Badge variant={totalPending > 0 ? "destructive" : "outline"} className="text-[9px]">
                                {new Intl.NumberFormat("fr-FR").format(totalPending)} FCFA en retard
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {agingData.length > 0 ? (
                            <DebtAgingChart data={agingData} />
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-xs text-muted-foreground uppercase font-semibold tracking-wide">
                                Données d&apos;ancienneté non exposées par l&apos;API finance
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="dashboard-block border-border" data-reveal>
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-tight">Recouvrement par Segment</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 uppercase font-black text-[10px]">
                                <TableHead className="px-6">Niveau / Cycle</TableHead>
                                <TableHead className="text-right">Encaissé</TableHead>
                                <TableHead className="text-right">Part du total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(data?.revenueByCycle || []).map((row: any, i: number) => {
                                const value = Number(row.value || 0);
                                const share = totalRevenue > 0 ? (value / totalRevenue) * 100 : 0;
                                return (
                                <TableRow key={i} className="text-xs hover:bg-muted/10">
                                    <TableCell className="px-6 font-bold">{row.name}</TableCell>
                                    <TableCell className="text-right font-black text-emerald-600">
                                        {new Intl.NumberFormat("fr-FR").format(value)}
                                    </TableCell>
                                    <TableCell className="text-right font-black">{share.toFixed(1)}%</TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
