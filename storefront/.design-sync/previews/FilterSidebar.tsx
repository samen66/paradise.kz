import { FilterSidebar } from "@/components/FilterSidebar";
import { sampleFacets } from "../support/sample-data";

// FilterSidebar's `aside` is `hidden lg:block` (its real desktop rendering)
// and its mobile trigger button is `lg:hidden` — both gated purely by
// viewport width via CSS, not a prop. cfg.overrides pins the capture
// viewport to 1100px (>= the `lg` breakpoint) so the real desktop panel
// shows instead of the collapsed mobile trigger. There's no way to also
// preview the mobile drawer-open state here: the override viewport is
// component-wide, not per-story, and the drawer only opens below `lg` where
// the trigger itself is visible — a genuine harness limitation, not a fix.
// The two exports instead sweep the one prop axis that's actually
// observable at this viewport: `isB2B` (hides the price-range filter).
export function Desktop() {
  return (
    <div className="w-72 bg-white">
      <FilterSidebar facets={sampleFacets} />
    </div>
  );
}

export function DesktopB2B() {
  return (
    <div className="w-72 bg-white">
      <FilterSidebar facets={sampleFacets} isB2B />
    </div>
  );
}
