export default function GradesLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-7 w-44 bg-muted/40 skeleton-shimmer rounded-md" />
                <div className="h-4 w-72 bg-muted/30 skeleton-shimmer rounded-md" />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/70 bg-card">
                <div className="h-9 w-48 bg-muted/40 skeleton-shimmer rounded-md" />
                <div className="h-9 w-36 bg-muted/40 skeleton-shimmer rounded-md" />
                <div className="h-9 w-36 bg-muted/40 skeleton-shimmer rounded-md" />
                <div className="flex-1" />
                <div className="h-9 w-28 bg-muted/40 skeleton-shimmer rounded-md" />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-muted/20">
                    {[80, 140, 100, 80, 80, 80].map((w, i) => (
                        <div key={i} className="h-4 bg-muted/40 skeleton-shimmer rounded" style={{ width: w }} />
                    ))}
                </div>
                {/* Rows */}
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border-b border-border/30 last:border-0">
                        <div className="h-4 w-20 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-4 w-36 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-4 w-24 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-4 w-16 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-4 w-16 bg-muted/30 skeleton-shimmer rounded" />
                        <div className="h-6 w-16 bg-muted/30 skeleton-shimmer rounded-full" />
                    </div>
                ))}
            </div>
        </div>
    );
}
