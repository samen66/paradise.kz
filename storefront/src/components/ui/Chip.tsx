"use client";

export function Chip({
  active = false,
  onClick,
  className = "",
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        active
          ? "border-inverse bg-inverse text-ink-inverse"
          : "border-line bg-surface text-ink hover:border-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}
