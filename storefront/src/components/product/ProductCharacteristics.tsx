import { getTranslations } from "next-intl/server";
import type { ProductCharacteristic } from "@/lib/types";

export async function ProductCharacteristics({
  characteristics,
}: {
  characteristics: ProductCharacteristic[];
}) {
  const t = await getTranslations("product");

  if (characteristics.length === 0) return null;

  return (
    <section className="rounded-[20px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)]">
      <h2 className="font-display text-xl font-bold text-ink">{t("characteristics")}</h2>
      <div className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
        {characteristics.map((ch) => (
          <div
            key={ch.slug}
            className="flex justify-between gap-4 border-b border-dashed border-line py-2.5 text-sm"
          >
            <span className="text-muted">{ch.name}</span>
            <span className="text-right font-medium text-ink">{ch.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
