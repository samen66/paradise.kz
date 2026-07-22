import { AccountLink } from "@/components/AccountLink";
import { useAuth } from "@/lib/auth";

// Zustand's `persist` middleware rehydrates from localStorage synchronously
// at module load (before any story below runs), which can carry state over
// from a previously-captured story in the same browser context. Seeding
// with a plain (non-effect) `setState` call during render — rather than in
// a useEffect — guarantees AccountLink's own internal `mounted` effect
// reads the correct value on its very first flip, with no extra
// render/re-render race. Each story sets the FULL state it needs (never
// just the fields it cares about) so it's correct regardless of history.
function seedAuth(loggedIn: boolean) {
  if (loggedIn) {
    useAuth.setState({
      token: "preview-session-token",
      user: { id: 501, name: "Айгерим Сатыбалдиева", email: "aigerim@example.kz", phone: "+7 701 555 12 34", type: "retail" },
    });
  } else {
    useAuth.setState({ token: null, user: null });
  }
}

export function Guest() {
  seedAuth(false);
  return (
    <div className="bg-white p-6">
      <AccountLink />
    </div>
  );
}

export function LoggedIn() {
  seedAuth(true);
  return (
    <div className="bg-white p-6">
      <AccountLink />
    </div>
  );
}
