import { useEffect } from "react";
import { ToastContainer } from "@/components/ui/Toast";
import { useToast } from "@/lib/toast";

// ToastContainer renders nothing until the shared `useToast` zustand store has
// items — it doesn't take toasts as props. We seed the store on mount via
// `useToast.getState().add(...)` (same function the app calls through the
// `toast()` helper) so the container has something real to render.
function seed(entries: Array<[string, "default" | "success" | "error"]>) {
  useToast.setState({ items: [] });
  entries.forEach(([message, variant], index) => {
    useToast.getState().add(message, variant);
    void index;
  });
}

export function Success() {
  useEffect(() => {
    seed([["Товар добавлен в корзину", "success"]]);
  }, []);
  return (
    <div style={{ minHeight: 160 }}>
      <ToastContainer />
    </div>
  );
}

export function ErrorState() {
  useEffect(() => {
    seed([["Не удалось применить промокод", "error"]]);
  }, []);
  return (
    <div style={{ minHeight: 160 }}>
      <ToastContainer />
    </div>
  );
}

export function Stacked() {
  useEffect(() => {
    seed([
      ["Заказ №10452 оформлен", "success"],
      ["Товара «Шкаф Oslo 3-дверный» осталось 3 шт.", "default"],
      ["Не удалось загрузить фото товара", "error"],
    ]);
  }, []);
  return (
    <div style={{ minHeight: 160 }}>
      <ToastContainer />
    </div>
  );
}
