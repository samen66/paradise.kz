"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

type Variant = "pill" | "dark" | "boxed";

interface QuantityInputProps {
  value: number;
  /** The minimum order: typed values below it are raised to it. */
  min: number;
  /** The stock the line may take, or null when the API hides it — the server still enforces it. */
  max: number | null;
  onChange: (quantity: number) => void;
  /** When set, "−" at the minimum stays enabled and calls this (the catalog removes the line there). */
  onBelowMin?: () => void;
  /** pill — cart line, dark — catalog card, boxed — product page. */
  variant?: Variant;
  label?: string;
  className?: string;
}

const containerClasses: Record<Variant, string> = {
  pill: "inline-flex items-center rounded-full border border-line-strong bg-surface p-1",
  dark: "inline-flex h-10 items-center rounded-full bg-ink p-1 text-white",
  boxed: "flex items-center justify-between rounded-xl border border-line bg-surface p-1",
};

const buttonClasses: Record<Variant, string> = {
  pill: "grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink transition hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50",
  dark: "grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg leading-none text-white transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40",
  boxed: "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50",
};

const inputClasses: Record<Variant, string> = {
  pill: "text-sm font-medium text-ink focus:bg-white focus:ring-2 focus:ring-ink/20",
  dark: "text-sm font-semibold text-white focus:bg-white/15 focus:ring-2 focus:ring-white/50",
  boxed: "font-medium text-ink focus:bg-white focus:ring-2 focus:ring-ink/20",
};

const noticeClasses: Record<Variant, string> = {
  pill: "left-0",
  dark: "right-0",
  boxed: "left-0",
};

/** Seven digits is well past any stock — longer input is a typo. */
const MAX_DIGITS = 7;
const NOTICE_MS = 3000;

/**
 * Quantity stepper whose number is also a text field: "−"/"+" for small
 * corrections, the keyboard for "100". A typed value is applied on Enter or
 * blur — not per keystroke, so typing "100" does not revalidate 1 and 10 —
 * and is brought into [min, max] with a short notice saying why.
 */
export function QuantityInput({
  value,
  min,
  max,
  onChange,
  onBelowMin,
  variant = "pill",
  label,
  className = "",
}: QuantityInputProps) {
  const t = useTranslations("common");
  // null: not editing, the field shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const skipCommit = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
  }, []);

  const atMax = max !== null && value >= max;
  const atMin = value <= min;
  const removes = atMin && onBelowMin !== undefined;
  const shown = draft ?? String(value);

  function flash(message: string) {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }

  function apply(wanted: number) {
    let next = Math.max(min, wanted);
    let message: string | null = next > wanted ? t("quantityRaised", { count: min }) : null;

    if (max !== null && next > max) {
      next = max;
      message = t("quantityCapped", { count: max });
    }

    if (message) {
      flash(message);
    }
    if (next !== value) {
      onChange(next);
    }
  }

  function commit() {
    const typed = draft;
    setDraft(null);

    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }

    const wanted = typed === null ? NaN : Number.parseInt(typed, 10);

    // Empty or zero puts the old value back: removing a line is the "Удалить" button's job.
    if (Number.isNaN(wanted) || wanted <= 0) {
      return;
    }

    apply(wanted);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      skipCommit.current = true;
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" && !atMax) {
      event.preventDefault();
      setDraft(null);
      apply(value + 1);
    } else if (event.key === "ArrowDown" && !atMin) {
      event.preventDefault();
      setDraft(null);
      apply(value - 1);
    }
  }

  const decreaseLabel = removes ? t("removeFromCart") : t("removeOne");
  const increaseLabel = atMax ? t("maxInCart", { count: max }) : t("addOneMore");

  return (
    <span className={`relative ${containerClasses[variant]} ${className}`}>
      <button
        type="button"
        onClick={() => (removes ? onBelowMin?.() : apply(value - 1))}
        disabled={atMin && !removes}
        aria-label={decreaseLabel}
        title={decreaseLabel}
        className={buttonClasses[variant]}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        role="spinbutton"
        aria-label={label ?? t("quantity")}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max ?? undefined}
        value={shown}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS))}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={{ width: `${Math.max(2, shown.length) + 1}ch` }}
        className={`min-w-0 rounded-md bg-transparent py-1 text-center tabular-nums outline-none transition ${inputClasses[variant]}`}
      />
      <button
        type="button"
        onClick={() => apply(value + 1)}
        disabled={atMax}
        aria-label={increaseLabel}
        title={increaseLabel}
        className={buttonClasses[variant]}
      >
        +
      </button>
      {notice ? (
        <span
          role="status"
          className={`absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-normal text-white shadow ${noticeClasses[variant]}`}
        >
          {notice}
        </span>
      ) : null}
    </span>
  );
}
