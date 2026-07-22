import { CartBadge } from "@/components/CartBadge";
import { useCart } from "@/lib/cart";

// CartBadge reads its item count from the persisted useCart Zustand store.
// Seed the full state synchronously (not in an effect) so the count is
// correct on first paint — the persist middleware would otherwise rehydrate
// from localStorage and carry over a previous capture's state.

export function Empty() {
  useCart.setState({ items: [] });
  return (
    <div className="bg-white p-4">
      <CartBadge />
    </div>
  );
}

export function WithItems() {
  useCart.setState({
    items: [
      {
        productId: 101,
        slug: "divan-milan-3-mestnyy",
        name: "Диван Milan прямой, 3-местный",
        image: null,
        price: 389900,
        quantity: 2,
      },
      {
        productId: 104,
        slug: "kreslo-ofisnoe-ergo-pro",
        name: "Кресло офисное Ergo Pro",
        image: null,
        price: 128000,
        quantity: 1,
      },
    ],
  });
  return (
    <div className="bg-white p-4">
      <CartBadge />
    </div>
  );
}
