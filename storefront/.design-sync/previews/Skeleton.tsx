import { Skeleton } from "@/components/ui/Skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="flex max-w-xs flex-col gap-3 rounded-2xl border border-line bg-white p-3">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}

export function TextLines() {
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function Grid() {
  return (
    <div className="grid max-w-2xl grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Shapes() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-24 w-40" />
    </div>
  );
}
