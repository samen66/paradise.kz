import { Suspense } from "react";
import { B2BCatalogView } from "@/components/b2b/B2BCatalogView";

export default function B2BCatalog() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <B2BCatalogView title="Оптовый каталог" seoDescription="Товары по оптовым ценам с учетом минимального количества." />
    </Suspense>
  );
}
