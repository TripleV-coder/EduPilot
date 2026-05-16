export default function ClassesLoading() {
    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                    <div className="h-7 w-32 bg-muted/40 skeleton-shimmer rounded-md" />
                    <div className="h-4 w-60 bg-muted/30 skeleton-shimmer rounded-md" />
                </div>
                <div className="h-9 w-36 bg-primary/20 skeleton-shimmer rounded-md" />
            </div>

            {/* Class cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/70 bg-card p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 skeleton-shimmer" />
                            <div className="space-y-1.5 flex-1">
                                <div className="h-4 w-24 bg-muted/40 skeleton-shimmer rounded" />
                                <div className="h-3 w-32 bg-muted/30 skeleton-shimmer rounded" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="h-3 w-20 bg-muted/30 skeleton-shimmer rounded" />
                            <div className="h-3 w-16 bg-muted/30 skeleton-shimmer rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
