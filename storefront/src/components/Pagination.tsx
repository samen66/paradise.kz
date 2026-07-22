import { Link } from "@/i18n/navigation";
import type { PaginationMeta } from "@/lib/types";

/**
 * Numbered pagination that preserves the current query string. Renders the
 * first/last page, a window around the current one, and ellipses between.
 */
export function Pagination({
  meta,
  pathname,
  searchParams,
}: {
  meta: PaginationMeta;
  pathname: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (meta.last_page <= 1) {
    return null;
  }

  const pages = Array.from({ length: meta.last_page }, (_, i) => i + 1).filter(
    (page) =>
      page === 1 ||
      page === meta.last_page ||
      Math.abs(page - meta.current_page) <= 2,
  );

  const withGaps: Array<number | "gap"> = [];
  for (const page of pages) {
    const previous = withGaps[withGaps.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      withGaps.push("gap");
    }
    withGaps.push(page);
  }

  const hrefFor = (page: number) => ({
    pathname,
    query: { ...searchParams, page: page === 1 ? undefined : String(page) },
  });

  return (
    <nav className="flex justify-center gap-1.5">
      {withGaps.map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} className="grid h-9 w-9 place-items-center text-muted">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefFor(entry)}
            className={
              entry === meta.current_page
                ? "grid h-9 min-w-9 place-items-center rounded-full bg-ink px-3 text-sm font-medium text-white"
                : "grid h-9 min-w-9 place-items-center rounded-full border border-line px-3 text-sm text-ink transition hover:border-ink"
            }
          >
            {entry}
          </Link>
        ),
      )}
    </nav>
  );
}
