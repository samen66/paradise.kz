/**
 * Customer-facing reading of an order's status: where it is on the
 * placed → confirmed → on its way → received path, and how its badge looks.
 *
 * `synced` / `failed` are statuses from the retired ERP push; they read as
 * "confirmed" and "placed" respectively.
 */

export type OrderStepKey = "placed" | "confirmed" | "inDelivery" | "readyForPickup" | "received";

const STEP_INDEX: Record<string, number> = {
  pending: 0,
  failed: 0,
  confirmed: 1,
  synced: 1,
  in_delivery: 2,
  completed: 3,
};

export function isCancelled(status: string): boolean {
  return status === "cancelled";
}

/** Index of the step the order has reached, 0-based. */
export function orderStepIndex(status: string): number {
  return STEP_INDEX[status] ?? 0;
}

export function orderSteps(deliveryMethod: "pickup" | "delivery"): OrderStepKey[] {
  return ["placed", "confirmed", deliveryMethod === "delivery" ? "inDelivery" : "readyForPickup", "received"];
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
    case "confirmed":
    case "synced":
      return "bg-mint text-mint-ink";
    case "in_delivery":
      return "bg-inverse text-ink-inverse";
    case "cancelled":
      return "bg-sale/10 text-sale";
    default:
      return "bg-black/5 text-muted dark:bg-white/10";
  }
}
