import { useEffect, useRef } from "react";
import { MegaMenu } from "@/components/MegaMenu";
import { sampleCategories } from "../support/sample-data";

// MegaMenu opens its dropdown from internal `useState` driven by a real
// `onMouseEnter` on the <li>, not a prop — there's no controlled/open prop to
// pass in. To capture the interesting (expanded) state in a static preview we
// dispatch a native "mouseover" on the first category's <li> after mount,
// which is what React's onMouseEnter delegation listens for.
function useOpenFirstItem(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const li = containerRef.current?.querySelector("li");
    if (!li) return;
    li.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
  }, [containerRef]);
}

export function Collapsed() {
  return (
    <nav className="border-b border-line px-6 py-2">
      <MegaMenu categories={sampleCategories} />
    </nav>
  );
}

export function Expanded() {
  const containerRef = useRef<HTMLDivElement>(null);
  useOpenFirstItem(containerRef);
  return (
    <div ref={containerRef} className="border-b border-line px-6 py-2">
      <MegaMenu categories={sampleCategories} />
    </div>
  );
}
