// Preview-only shim for next/link. Real next/link (and next-intl's Link,
// which wraps it) pulls in Next's client router internals
// (has-base-path.js, resolve-href.js, is-local-url.js) which read
// `process.env.*` at module scope — fine under webpack (DefinePlugin-shimmed),
// not under esbuild's plain browser bundle. Remapped in here via
// tsconfig.design-sync.json's `paths`, resolved before normal node_modules
// resolution (see .design-sync/config.json's `tsconfig`).
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Href = string | { pathname?: string; query?: Record<string, string> };

function toHref(href: Href): string {
  if (typeof href === "string") return href;
  return href?.pathname ?? "#";
}

export default function Link({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  shallow: _shallow,
  legacyBehavior: _legacyBehavior,
  locale: _locale,
  ...rest
}: {
  href: Href;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={toHref(href)} {...rest}>
      {children}
    </a>
  );
}
