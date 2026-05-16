export default function TeachersLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                    <div className="h-7 w-40 bg-muted/40 skeleton-shimmer rounded-md" />
                    <div className="h-4 w-56 bg-muted/30 skeleton-shimmer rounded-md" />
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-28 bg-muted/40 skeleton-shimmer rounded-md" />
                    <div className="h-9 w-36 bg-primary/20 skeleton-shimmer rounded-md" />
                </div>
            </div>

            {/* Search bar */}
            <div className="rounded-xl border border-border/70 bg-card p-4">
                <div className="flex items-center gap-3">
                    <div className="h-9 flex-1 max-w-md bg-muted/30 skeleton-shimmer rounded-md" />
                    <div className="h-9 w-36 bg-muted/40 skeleton-shimmer rounded-md" />
                </div>
            </div>

            {/* Table rows */}
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
                <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-muted/20">
                    {[40, 140, 160, 100, 80].map((w, i) => (
                        <div key={i} className="h-4 bg-muted/40 skeleton-shimmer rounded" style={{ width: w }} />
                    ))}
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border-b border-border/30 last:border-0">
                        <div className="w-10 h-10 rounded-full bg-muted/40 skeleton-shimmer" />
                        <div className="h-4 w-32 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-4 w-40 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-4 w-24 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-6 w-16 bg-muted/30 skeleton-shimmer rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
