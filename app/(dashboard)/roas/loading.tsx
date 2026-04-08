import { Skeleton } from "@/components/ui/skeleton";

export default function RoasLoading() {
  return (
    <div className="space-y-6">
      {/* Tab nav skeleton */}
      <Skeleton className="h-12 w-64 rounded-2xl" />
      {/* Header card skeleton */}
      <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6">
        <Skeleton className="h-6 w-32 mb-3" />
        <Skeleton className="h-8 w-80 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      {/* Content skeleton */}
      <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    </div>
  );
}
