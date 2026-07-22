import { Carousel } from "@/components/Carousel";
import { ProductCard } from "@/components/ProductCard";
import {
  sampleProducts,
  sampleNewArrivalProduct,
  sampleSaleProduct,
} from "../support/sample-data";

// Mirrors the real usage in src/app/[locale]/page.tsx: a Carousel of
// ProductCard items, each wrapped in the app's real responsive-width class
// so the row overflows the viewport and the scroll affordance is realistic.
const rowProducts = [...sampleProducts, sampleNewArrivalProduct, sampleSaleProduct];

export function ProductRow() {
  return (
    <div className="max-w-3xl bg-canvas p-6">
      <h2 className="font-display text-2xl font-semibold text-ink mb-6">Новинки недели</h2>
      <Carousel>
        {rowProducts.map((product) => (
          <div
            key={product.id}
            className="w-[calc(60vw)] sm:w-[calc(40vw)] lg:w-[calc(25%-15px)] flex-shrink-0 snap-start"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </Carousel>
    </div>
  );
}
