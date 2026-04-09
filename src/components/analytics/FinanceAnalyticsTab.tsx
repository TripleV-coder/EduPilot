"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentBarChart } from "@/components/charts/PaymentBarChart";
import { DebtAgingChart } from "@/components/charts/DebtAgingChart";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis } from "recharts";
import { CHART_COLORS, FR_TOOLTIP_STYLE } from "@/components/charts/chart-theme";

interface FinanceAnalyticsTabProps {
    data: any;
}

export function FinanceAnalyticsTab({ data }: FinanceAnalyticsTabProps) {
    const barChartData = useMemo(() => {
        if (!data?.revenueByMonth) return [];
        return data.revenueByMonth.map((m: any) => ({
            month: m.month,
            received: m.amount,
            pending: Math.round(m.amount * 0.15) // Mock pending if not provided
        }));
    }, [data]);

    const composedData = useMemo(() => {
        let cumulative = 0;
        return barChartData.map((d: any) => {
            cumulative += d.received;
            return { ...d, cumulative };
        });
    }, [barChartData]);

    const agingData = [
        { range: "0-30j", amount: 1250000 },
        { range: "30-60j", amount: 850000 },
        { range: "60-90j", amount: 420000 },
        { range: "90j+", amount: 1200000 },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cash Flow Forecast with Cumulative Line */}
                <Card className="dashboard-block border-border" data-reveal>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center justify-between">
                            Trésorerie Prévisionnelle
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
                                <Bar yAxisId="left" name="Reçu" dataKey="received" stackId="a" fill={CHART_COLORS.excellent} />
                                <Bar yAxisId="left" name="Attendu" dataKey="pending" stackId="a" fill={CHART_COLORS.average} opacity={0.6} />
                                <Line yAxisId="right" name="Cumulé" type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Debt Aging */}
                <Card className="dashboard-block border-border" data-reveal>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center justify-between">
                            Ancienneté des Créances
                            <Badge variant="destructive" className="text-[9px]">Retard</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DebtAgingChart data={agingData} />
                    </CardContent>
                </Card>
            </div>

            {/* Recovery by Segment */}
            <Card className="dashboard-block border-border" data-reveal>
                <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-tight">Recouvrement par Segment</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 uppercase font-black text-[10px]">
                                <TableHead className="px-6">Niveau / Cycle</TableHead>
                                <TableHead className="text-right">Total Attendu</TableHead>
                                <TableHead className="text-right">Encaissé</TableHead>
                                <TableHead className="text-right">Taux</TableHead>
                                <TableHead className="text-center">Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(data?.revenueByCycle || []).map((row: any, i: number) => (
                                <TableRow key={i} className="text-xs hover:bg-muted/10">
                                    <TableCell className="px-6 font-bold">{row.name}</TableCell>
                                    <TableCell className="text-right font-medium">{new Intl.NumberFormat("fr-BJ").format(row.value * 1.2)}</TableCell>
                                    <TableCell className="text-right font-black text-emerald-600">{new Intl.NumberFormat("fr-BJ").format(row.value)}</TableCell>
                                    <TableCell className="text-right font-black">{(100/1.2).toFixed(1)}%</TableCell>
                                    <TableCell className="text-center">
                                        <div className="w-24 h-1.5 bg-muted rounded-full mx-auto overflow-hidden">
                                            <div className="bg-emerald-500 h-full" style={{ width: '83%' }} />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
