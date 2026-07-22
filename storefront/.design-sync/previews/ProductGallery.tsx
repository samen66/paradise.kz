import { useEffect, useRef } from "react";
import { ProductGallery } from "@/components/ProductGallery";
import { sampleProducts } from "../support/sample-data";

// activeIndex is internal useState with no prop to set it directly. To
// capture the active-thumbnail bordered-highlight state for a static
// screenshot we grab a ref to the rendered thumbnail strip and dispatch a
// real click on the 2nd thumbnail button after mount — same technique as
// MegaMenu's hover-driven dropdown capture.
function useClickSecondThumbnail(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const buttons = ref.current?.querySelectorAll("button");
    const second = buttons?.[1];
    second?.click();
  }, [ref]);
}

export function MultiImage() {
  return (
    <div className="max-w-md">
      <ProductGallery images={sampleProducts[0].images} alt={sampleProducts[0].name} />
    </div>
  );
}

export function SingleImage() {
  return (
    <div className="max-w-md">
      <ProductGallery images={sampleProducts[2].images} alt={sampleProducts[2].name} />
    </div>
  );
}

export function ActiveThumbnail() {
  const containerRef = useRef<HTMLDivElement>(null);
  useClickSecondThumbnail(containerRef);
  return (
    <div ref={containerRef} className="max-w-md">
      <ProductGallery images={sampleProducts[0].images} alt={sampleProducts[0].name} />
    </div>
  );
}
