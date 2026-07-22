import { getTranslations } from "next-intl/server";

export async function ProductDescription({ description }: { description: string }) {
  const t = await getTranslations("product");

  return (
    <section className="rounded-[20px] border border-line bg-white p-7 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_12px_32px_rgba(28,26,23,0.05)]">
      <h2 className="font-display text-xl font-bold text-ink">{t("description")}</h2>
      <p className="mt-4 text-[15px] leading-[1.65] text-muted">{description}</p>
    </section>
  );
}
