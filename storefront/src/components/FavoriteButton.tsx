"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Never-updating external store — just a lint-clean way to know we've hydrated. */
const subscribeNever = () => () => {};

/**
 * Wishlist toggle. Hidden for guests — favorites live on the account, and the
 * button appearing after login is signal enough. Designed to sit absolutely
 * positioned over a product photo (pass `className` for placement) as well as
 * standalone on the product page.
 */
export function FavoriteButton({ productId, className = "" }: { productId: number; className?: string }) {
  const t = useTranslations("common");
  const token = useAuth((state) => state.token);
  // True only after the client has hydrated — avoids a hydration mismatch
  // without calling setState synchronously inside an effect body.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!mounted || !token) {
      return;
    }
    void apiGet<{ data: Array<{ id: number }> }>("/account/favorites", { token, revalidate: false })
      .then((response) => setActive(response.data.some((product) => product.id === productId)))
      .catch(() => undefined);
  }, [mounted, token, productId]);

  if (!mounted || !token) {
    return null;
  }

  async function toggle() {
    setActive((current) => !current);
    try {
      if (active) {
        await apiDelete(`/account/favorites/${productId}`, { token });
      } else {
        await apiPut(`/account/favorites/${productId}`, {}, { token });
      }
    } catch {
      setActive((current) => !current);
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        // May sit inside a <Link> over the product photo — don't navigate.
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
      aria-pressed={active}
      aria-label={t("favorite")}
      className={`grid h-9 w-9 place-items-center rounded-full border bg-white transition ${
        active ? "border-ink text-ink" : "border-line text-muted hover:border-ink hover:text-ink"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.6}
        aria-hidden="true"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5.5 5.5 5.5c1.9 0 3.2 1.1 4 2.2.8-1.1 2.1-2.2 4-2.2 3 0 4.5 3 3 6C19 15.65 12 20 12 20Z"
        />
      </svg>
    </button>
  );
}
