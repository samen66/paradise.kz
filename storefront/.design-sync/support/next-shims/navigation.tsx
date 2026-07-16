// Preview-only shim for next/navigation. See link.tsx for why this is
// remapped via tsconfig.design-sync.json rather than the real module.
// useRouter() specifically hard-crashes ("invariant expected app router to
// be mounted") outside a mounted App Router — confirmed by reading
// node_modules/next/dist/client/components/navigation.js directly.

const noopRouter = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  back: () => {},
  forward: () => {},
  prefetch: () => {},
};

export function useRouter() {
  return noopRouter;
}

export function usePathname(): string {
  return "/";
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string | string[]> {
  return {};
}

export function notFound(): never {
  throw new Error("notFound() called in a design-sync preview");
}

export function redirect(): never {
  throw new Error("redirect() called in a design-sync preview");
}

export function permanentRedirect(): never {
  throw new Error("permanentRedirect() called in a design-sync preview");
}
