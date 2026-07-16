import { ProductCard } from "@/components/ProductCard";
import { sampleProduct, sampleOutOfStockProduct } from "../support/sample-data";

export function InStock() {
  return (
    <div className="max-w-xs">
      <ProductCard product={sampleProduct} />
    </div>
  );
}

export function OutOfStock() {
  return (
    <div className="max-w-xs">
      <ProductCard product={sampleOutOfStockProduct} />
    </div>
  );
}

export function B2B() {
  return (
    <div className="max-w-xs">
      <ProductCard product={{ ...sampleProduct, b2b_min_order_qty: 10 }} isB2B />
    </div>
  );
}

export function Grid() {
  return (
    <div className="grid max-w-2xl grid-cols-2 gap-4">
      <ProductCard product={sampleProduct} />
      <ProductCard product={sampleOutOfStockProduct} />
    </div>
  );
}
