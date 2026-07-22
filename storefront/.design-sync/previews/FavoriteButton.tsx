import { FavoriteButton } from "@/components/FavoriteButton";
import { useAuth } from "@/lib/auth";

// FavoriteButton is hidden entirely for guests (real app behavior — favorites
// live on the account), so every story needs a signed-in user. It also reads
// its "is this favorited" state from a GET on mount rather than a prop, so
// showing both the active/inactive branches means composing around that
// fetch: a thin stub answering only `/account/favorites` with realistic JSON
// (falling through to the real fetch for anything else) drives the real
// component's real effect, exactly like a design-system Storybook mock would
// — the button, the toggle logic, and the render are all the genuine
// component, only the network layer is faked so it resolves instantly and
// deterministically instead of failing against an unreachable backend.
function seedSignedIn() {
  useAuth.setState({
    token: "preview-session-token",
    user: { id: 501, name: "Айгерим Сатыбалдиева", email: "aigerim@example.kz", phone: "+7 701 555 12 34", type: "retail" },
  });
}

function stubFavorites(activeProductIds: number[]) {
  const realFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/account/favorites")) {
      return new Response(JSON.stringify({ data: activeProductIds.map((id) => ({ id })) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof window.fetch;
}

export function Inactive() {
  seedSignedIn();
  stubFavorites([]);
  return (
    <div className="bg-card p-6">
      <FavoriteButton productId={101} />
    </div>
  );
}

export function Active() {
  seedSignedIn();
  stubFavorites([101]);
  return (
    <div className="bg-card p-6">
      <FavoriteButton productId={101} />
    </div>
  );
}
