import { Skeleton } from "@/components/ui/skeleton";

export default function ZoneLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6">
        <Skeleton className="h-6 w-40 mb-3" />
        <Skeleton className="h-8 w-72 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      {/* Map + panel skeleton */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 280px)" }}>
        <Skeleton className="w-[70%] rounded-2xl" />
        <div className="w-[30%] space-y-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
