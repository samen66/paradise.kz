"use client";

import { useState } from "react";
import type { Category, Settings } from "@/lib/types";
import { BurgerDrawer } from "./BurgerDrawer";

export function HeaderBurger({
  categories,
  settings,
}: {
  categories: Category[];
  settings: Settings | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Меню"
        className="grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-panel md:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <BurgerDrawer
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        settings={settings}
      />
    </>
  );
}
