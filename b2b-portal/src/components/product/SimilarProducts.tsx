import { getTranslations } from "next-intl/server";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";

export async function SimilarProducts({ products }: { products: Product[] }) {
  const t = await getTranslations("product");

  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
        {t("similar")}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
