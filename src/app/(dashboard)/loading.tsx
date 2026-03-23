export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" aria-label="Chargement en cours">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>
      </div>
    </div>
  );
}
