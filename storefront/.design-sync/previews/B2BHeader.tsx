import { B2BHeader } from "@/components/b2b/B2BHeader";
import { useB2bAuth } from "@/stores/useB2bAuth";

// B2BHeader reads the signed-in user from the real, persisted useB2bAuth
// Zustand store. Seed the full state synchronously (both token and user,
// never partial) so the profile icon's conditional render is correct on
// first paint regardless of stale localStorage from a prior capture.

export function Guest() {
  useB2bAuth.setState({ token: null, user: null });
  return <B2BHeader />;
}

export function SignedIn() {
  useB2bAuth.setState({
    token: "preview-b2b-session-token",
    user: {
      id: 900,
      name: "Данияр Ахметов",
      email: "b2b@example.kz",
      phone: "+7 701 999 88 77",
      type: "b2b",
      company_name: "ТОО Мебель Плюс",
      company_bin: "870512300123",
      is_approved: true,
    },
  });
  return <B2BHeader />;
}
