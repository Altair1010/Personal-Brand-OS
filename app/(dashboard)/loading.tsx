export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-8 w-56 rounded bg-muted" />
      <div className="h-4 w-96 max-w-full rounded bg-muted/70" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 rounded-xl border bg-muted/30" />
        <div className="h-28 rounded-xl border bg-muted/30" />
        <div className="h-28 rounded-xl border bg-muted/30" />
      </div>
      <div className="h-72 rounded-xl border bg-muted/20" />
    </div>
  );
}
