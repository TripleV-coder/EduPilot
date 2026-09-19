"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function StudentsLoading() {
  
  return (
    <div className="edu-stagger-loading container mx-auto p-6 space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="edu-pulse-bg h-8 w-48 rounded-lg" />
          <div className="edu-pulse-bg h-4 w-64 rounded-lg" />
        </div>
        <div className="flex gap-3">
          <div className="edu-pulse-bg h-10 w-32 rounded-lg" />
          <div className="edu-pulse-bg h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="edu-pulse-bg h-10 w-48 rounded-lg" />
        <div className="edu-pulse-bg h-10 w-32 rounded-lg" />
        <div className="edu-pulse-bg h-10 w-32 rounded-lg" />
        <div className="edu-pulse-bg h-10 w-10 rounded-lg ml-auto" />
      </div>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i}>
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="edu-pulse-bg h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="edu-pulse-bg h-4 w-full rounded" />
                    <div className="edu-pulse-bg h-3 w-20 rounded" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="edu-pulse-bg h-3 w-16 rounded" />
                    <div className="edu-pulse-bg h-3 w-12 rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="edu-pulse-bg h-3 w-20 rounded" />
                    <div className="edu-pulse-bg h-5 w-16 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between pt-4">
        <div className="edu-pulse-bg h-4 w-32 rounded" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="edu-pulse-bg h-10 w-10 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
