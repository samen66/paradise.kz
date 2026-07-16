import { HeaderBurger } from "@/components/HeaderBurger";
import { sampleCategories, sampleSettings } from "../support/sample-data";

export function Default() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <HeaderBurger categories={sampleCategories} settings={sampleSettings} />
      <span className="font-display text-sm font-semibold text-ink">Paradise.kz</span>
    </div>
  );
}

export function NoSettings() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-3">
      <HeaderBurger categories={sampleCategories} settings={null} />
      <span className="font-display text-sm font-semibold text-ink">Paradise.kz</span>
    </div>
  );
}

export function InHeaderBar() {
  return (
    <div className="flex max-w-md items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
      <HeaderBurger categories={sampleCategories} settings={sampleSettings} />
      <span className="font-display text-base font-semibold text-ink">Paradise.kz</span>
      <div className="h-10 w-10" />
    </div>
  );
}
