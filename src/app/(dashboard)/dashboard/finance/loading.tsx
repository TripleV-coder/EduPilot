"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function FinanceLoading() {
  return (
    <div className="edu-stagger-loading container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="edu-pulse-bg h-8 w-48 rounded-lg" />
        <div className="edu-pulse-bg h-4 w-72 rounded-lg" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <Card>
              <CardHeader className="pb-2">
                <div className="edu-pulse-bg h-4 w-24 rounded" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="edu-pulse-bg h-8 w-32 rounded" />
                <div className="edu-pulse-bg h-3 w-20 rounded" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="edu-pulse-bg h-5 w-48 rounded" />
            </CardHeader>
            <CardContent>
              <div className="edu-pulse-bg h-[300px] rounded-lg" />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <div className="edu-pulse-bg h-5 w-32 rounded" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="edu-pulse-bg h-3 w-3 rounded-full" />
                  <div className="edu-pulse-bg h-4 flex-1 rounded" />
                  <div className="edu-pulse-bg h-4 w-16 rounded" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transactions Table */}
      <div>
        <Card>
          <CardHeader>
            <div className="edu-pulse-bg h-5 w-40 rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Table header */}
            <div className="flex gap-4 pb-2 border-b">
              {["Date", "Description", "Catégorie", "Montant", "Statut"].map((_, i) => (
                <div key={i} className="edu-pulse-bg h-4 flex-1 rounded" />
              ))}
            </div>
            {/* Table rows */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center py-2">
                <div className="edu-pulse-bg h-4 flex-1 rounded" />
                <div className="edu-pulse-bg h-4 flex-1 rounded" />
                <div className="edu-pulse-bg h-6 w-24 rounded-full" />
                <div className="edu-pulse-bg h-4 w-20 rounded" />
                <div className="edu-pulse-bg h-6 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
