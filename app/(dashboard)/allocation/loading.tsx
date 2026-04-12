import { Skeleton } from "@/components/ui/skeleton";

export default function AllocationLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6">
        <Skeleton className="h-5 w-24 mb-3" />
        <Skeleton className="h-8 w-72 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
