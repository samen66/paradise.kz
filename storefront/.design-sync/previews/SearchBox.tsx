"use client";

import { useEffect, useRef } from "react";
import { SearchBox } from "@/components/SearchBox";

// SearchBox takes no props; its defaultValue comes from the always-empty
// useSearchParams() shim, so the input is always uncontrolled-empty by
// default. The Typed story sets a realistic value directly on the input DOM
// node via a ref — legitimate here since the input is uncontrolled
// (defaultValue, not value), so this is a real DOM state, not a fake overlay.

export function Default() {
  return (
    <div className="bg-white p-4">
      <SearchBox />
    </div>
  );
}

export function Typed() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const input = ref.current?.querySelector("input");
    if (input) {
      input.value = "диван угловой";
    }
  }, []);

  return (
    <div ref={ref} className="bg-white p-4">
      <SearchBox />
    </div>
  );
}
