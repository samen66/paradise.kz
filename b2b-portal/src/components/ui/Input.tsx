import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  {
    label?: string;
    hint?: string;
    error?: string;
  } & InputHTMLAttributes<HTMLInputElement>
>(function Input({ label, hint, error, className = "", id, ...rest }, ref) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-ink placeholder:text-muted outline-none transition-colors duration-200 ${
          error ? "border-sale focus:border-sale" : "border-line focus:border-ink"
        }`}
        {...rest}
      />
      {error ? <p className="mt-1.5 text-xs text-sale">{error}</p> : null}
      {hint && !error ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
});
