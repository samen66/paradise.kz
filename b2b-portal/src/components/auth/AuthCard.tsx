import type { ReactNode } from "react";

export const authInputClass =
  "w-full px-4 py-2 border border-line rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink";

export const authPrimaryButtonClass =
  "w-full bg-ink text-white py-3 rounded-lg font-medium hover:bg-ink-hover transition-colors disabled:opacity-50";

type Props = {
  brand: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered card shared by the login and registration pages. */
export function AuthCard({ brand, title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-line p-8">
        <div className="text-center mb-6">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink mb-1">{brand}</div>
          <h1 className="text-lg font-medium text-ink">{title}</h1>
          {subtitle ? <p className="text-sm text-muted mt-1">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
