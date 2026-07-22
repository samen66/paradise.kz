import { useEffect, useRef } from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { sampleProduct, sampleProducts } from "../support/sample-data";

// justAdded is internal useState with no controlling prop, toggled by the
// button's own onClick handler (handleAdd). To capture the confirmed
// "✓ Добавлено" state for a static screenshot we grab a ref to the real
// <button> DOM node and dispatch a real click shortly after mount — same
// technique as MegaMenu's hover-driven dropdown capture.
function useAutoClick(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const button = ref.current?.querySelector("button");
    if (!button) return;
    button.click();
  }, [ref]);
}

export function Full() {
  return (
    <div className="max-w-xs">
      <AddToCartButton product={sampleProduct} />
    </div>
  );
}

export function Compact() {
  return (
    <div className="flex items-center gap-3">
      <AddToCartButton product={sampleProducts[3]} compact />
    </div>
  );
}

export function CompactB2B() {
  return (
    <div className="flex items-center gap-3">
      <AddToCartButton product={sampleProducts[3]} compact isB2B />
    </div>
  );
}

export function JustAdded() {
  const containerRef = useRef<HTMLDivElement>(null);
  useAutoClick(containerRef);
  return (
    <div ref={containerRef} className="max-w-xs">
      <AddToCartButton product={sampleProduct} />
    </div>
  );
}
