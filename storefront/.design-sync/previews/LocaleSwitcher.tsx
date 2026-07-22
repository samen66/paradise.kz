import { LocaleSwitcher } from "@/components/LocaleSwitcher";

// LocaleSwitcher resolves the active locale via useParams().locale, falling
// back to useLocale(). The preview shims always return {} from useParams()
// and the global provider fixes useLocale() at "ru" — so "ru" is always the
// active locale here. There is no prop or mock to force a "kk active" state
// from within a single story; see .design-sync/learnings/batch1.md.

export function Default() {
  return (
    <div className="bg-white p-4">
      <LocaleSwitcher />
    </div>
  );
}
