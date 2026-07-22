/**
 * Partial-fill star rating display. Renders 5 stars with optional fractional
 * fill (e.g. 4.7 → four full + 70% of the fifth). Matches the design system's
 * star SVG path and overlay-clip technique from Stars.dc.html.
 */
export function StarRating({
  rating,
  size = 16,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const gap = Math.max(1, Math.round(size * 0.1));

  return (
    <span className={`inline-flex items-center leading-[0] ${className}`} style={{ gap }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)));
        return (
          <span key={i} className="relative inline-block leading-[0]">
            {/* Empty star (background) */}
            <svg width={size} height={size} viewBox="0 0 24 24" className="block">
              <path
                d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23 6.09 20.34l1.13-6.57L2.45 9.14l6.6-.96z"
                className="fill-star-empty"
              />
            </svg>
            {/* Filled star (clipped overlay) */}
            <span
              className="absolute inset-y-0 left-0 overflow-hidden leading-[0]"
              style={{ width: `${fill * 100}%` }}
            >
              <svg width={size} height={size} viewBox="0 0 24 24" className="block">
                <path
                  d="M12 2.2l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.23 6.09 20.34l1.13-6.57L2.45 9.14l6.6-.96z"
                  className="fill-star"
                />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}
