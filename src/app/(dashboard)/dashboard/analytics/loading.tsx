"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Animation variants for staggered loading effect
export default function AnalyticsLoading() {
  return (
    <div className="edu-stagger-loading container mx-auto p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="edu-pulse-bg h-8 w-64 rounded-lg" />
        <div className="edu-pulse-bg h-4 w-96 rounded-lg" />
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="edu-pulse-bg h-4 w-24 rounded" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="edu-pulse-bg h-8 w-32 rounded" />
                <div className="edu-pulse-bg h-3 w-20 rounded" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="edu-pulse-bg h-5 w-40 rounded" />
            </CardHeader>
            <CardContent>
              <div className="edu-pulse-bg h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Secondary Charts */}
        {[...Array(2)].map((_, i) => (
          <div key={i}>
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="edu-pulse-bg h-5 w-32 rounded" />
              </CardHeader>
              <CardContent>
                <div className="edu-pulse-bg h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Data Table Skeleton */}
      <div>
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="edu-pulse-bg h-5 w-48 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="edu-pulse-bg h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="edu-pulse-bg h-4 w-48 rounded" />
                  <div className="edu-pulse-bg h-3 w-24 rounded" />
                </div>
                <div className="edu-pulse-bg h-8 w-24 rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
