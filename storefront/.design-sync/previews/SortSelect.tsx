import { SortSelect } from "@/components/SortSelect";

// SortSelect reads useSearchParams().get("sort") via the shimmed hook, which
// always returns an empty URLSearchParams — the select always defaults to
// "По названию" selected. isB2B is the only real, achievable variant axis:
// it hides the two price-sort options.

export function Retail() {
  return (
    <div className="bg-white p-4">
      <SortSelect />
    </div>
  );
}

export function B2B() {
  return (
    <div className="bg-white p-4">
      <SortSelect isB2B />
    </div>
  );
}
