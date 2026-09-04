import { Suspense } from "react";
import { B2BCatalogView } from "@/components/B2BCatalogView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Оптовый каталог",
  description: "Товары по оптовым ценам с учётом минимального количества заказа.",
};

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <B2BCatalogView
        title="Оптовый каталог"
        seoDescription="Товары по оптовым ценам с учётом минимального количества заказа."
      />
    </Suspense>
  );
}
