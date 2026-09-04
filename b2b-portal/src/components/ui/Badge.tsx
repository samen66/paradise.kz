const variants = {
  default: "bg-black/5 text-muted",
  mint: "bg-mint text-mint-ink",
  sale: "bg-sale text-sale-ink",
  outline: "border border-line text-muted",
} as const;

export function Badge({
  variant = "default",
  className = "",
  children,
}: {
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
