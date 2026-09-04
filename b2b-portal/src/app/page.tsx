import { redirect } from "next/navigation";

// Root "/" redirects to catalog for authenticated users.
// The actual auth check is done in the (portal) layout.
export default function RootPage() {
  redirect("/catalog");
}
