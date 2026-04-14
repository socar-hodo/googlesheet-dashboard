export default function FunnelLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 w-16 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-card/80"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-card/80" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl bg-card/80" />
        <div className="col-span-2 h-72 animate-pulse rounded-2xl bg-card/80" />
      </div>
    </div>
  );
}
