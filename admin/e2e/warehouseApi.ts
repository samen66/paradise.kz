import path from "node:path";
import { test, type APIRequestContext } from "@playwright/test";
import { adminApi } from "./adminApi";

type Created = { data: { id: number } };

/**
 * Помощники e2e для склада. Товар заводится выключенным (на витрину не
 * попадёт), место хранения — неактивным (StoreResolver его не выберет), так
 * что общие фикстуры приёмки не задеваются.
 */

/** Уникальная метка на тест: параллельные тесты в одну миллисекунду иначе получают одинаковые имена. */
export function uniqueStamp(): number {
  return Date.now() * 100 + test.info().parallelIndex;
}

export async function createProduct(request: APIRequestContext, stamp: number, extra: Record<string, unknown> = {}, suffix = "") {
  const name = `E2E товар ${stamp}${suffix}`;
  const product = await adminApi(request).create<Created>("/admin/products", { name: { ru: name }, is_active: false, ...extra });
  return { id: product.data.id, name };
}

export async function createStore(request: APIRequestContext, stamp: number, suffix = "") {
  const name = `E2E склад ${stamp}${suffix}`;
  const store = await adminApi(request).create<Created>("/admin/stores", { name, is_active: false });
  return { id: store.data.id, name };
}

/** Проведённая приёмка — единственный честный способ завести остаток. */
export async function receive(request: APIRequestContext, storeId: number, productId: number, quantity: number, unitCost = 1000) {
  const api = adminApi(request);
  const receipt = await api.create<Created>("/admin/goods-receipts", { store_id: storeId });
  await api.create(`/admin/goods-receipts/${receipt.data.id}/items`, { product_id: productId, quantity, unit_cost: unitCost });
  await api.send("post", `/admin/goods-receipts/${receipt.data.id}/post`);
}

/** Черновик приёмки на месте хранения теста — сразу через API, без экрана создания. */
export async function createReceiptDraft(request: APIRequestContext, storeId: number): Promise<number> {
  const receipt = await adminApi(request).create<Created>("/admin/goods-receipts", { store_id: storeId });
  return receipt.data.id;
}

export async function createWriteOffDraft(request: APIRequestContext, storeId: number): Promise<number> {
  const writeOff = await adminApi(request).create<Created>("/admin/write-offs", { store_id: storeId, reason: "damaged" });
  return writeOff.data.id;
}

/** Фото товара — однопиксельный PNG из e2e/assets. */
export async function addPhoto(request: APIRequestContext, productId: number) {
  await adminApi(request).upload(`/admin/products/${productId}/media`, path.join(__dirname, "assets/pixel.png"), "image/png");
}
