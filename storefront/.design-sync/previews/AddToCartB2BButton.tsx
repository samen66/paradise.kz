import { AddToCartB2BButton } from "@/components/b2b/AddToCartB2BButton";
import { useB2bCart } from "@/stores/useB2bCart";
import { sampleProducts } from "../support/sample-data";

// AddToCartB2BButton reads its "already in cart" branch from useB2bCart by
// matching product.id — seeding the store before render (not in an effect;
// Zustand's setState is safe to call synchronously at module/render time and
// the component reads the store on every render) drives that branch
// deterministically per story, the same pattern as the auth-store previews.

const qtyProduct = { ...sampleProducts[3], id: 9101, b2b_min_order_qty: 5 }; // Кресло офисное Ergo Pro, min order 5
const inCartProduct = { ...sampleProducts[0], id: 9102, b2b_min_order_qty: 1 }; // Диван Milan
const outOfStockProduct = { ...sampleProducts[2], id: 9103 }; // Стол кухонный Round — in_stock: false

export function EmptyQtyPicker() {
  useB2bCart.setState({ items: useB2bCart.getState().items.filter((i) => i.product.id !== qtyProduct.id) });
  return (
    <div className="max-w-md bg-white p-4">
      <AddToCartB2BButton product={qtyProduct} />
    </div>
  );
}

export function AlreadyInCart() {
  useB2bCart.setState({
    items: [
      ...useB2bCart.getState().items.filter((i) => i.product.id !== inCartProduct.id),
      { product: inCartProduct, quantity: 3 },
    ],
  });
  return (
    <div className="max-w-md bg-white p-4">
      <AddToCartB2BButton product={inCartProduct} />
    </div>
  );
}

export function OutOfStock() {
  return (
    <div className="max-w-md bg-white p-4">
      <AddToCartB2BButton product={outOfStockProduct} />
    </div>
  );
}
