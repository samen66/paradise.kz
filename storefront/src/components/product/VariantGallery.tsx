"use client";

import { ProductGallery } from "@/components/ProductGallery";
import type { Product } from "@/lib/types";
import { useSelectedVariant } from "./SelectedVariant";

/** Галерея товара; у выбранного варианта со своими фото — его фото. */
export function VariantGallery({ product, alt }: { product: Product; alt: string }) {
  const { variantId } = useSelectedVariant();
  const variantImages = product.variants?.find((v) => v.id === variantId)?.images ?? [];
  const ownImages = variantImages.length > 0;

  // key: при смене набора фото галерея начинает с первого, а не с индекса прошлого набора.
  return <ProductGallery key={ownImages ? `variant-${variantId}` : "product"} images={ownImages ? variantImages : product.images} alt={alt} />;
}
