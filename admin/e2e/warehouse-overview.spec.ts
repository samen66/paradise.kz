import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createProduct, createStore, receive, uniqueStamp } from "./warehouseApi";

/**
 * Вкладка «Обзор»: цифры запаса одним взглядом и переходы в отфильтрованные
 * списки, последние движения.
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» открывается на обзоре с четырьмя плитками", async ({ page }) => {
  await page.goto("/warehouse");

  const tabs = page.getByRole("navigation", { name: "Разделы склада" });
  await expect(tabs.getByRole("link", { name: "Обзор" })).toHaveAttribute("aria-current", "page");

  for (const label of ["Стоимость запаса", "Заканчивается", "Нет в наличии", "Черновики"]) {
    await expect(page.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }

  await page.getByRole("link", { name: /Заканчивается/ }).click();
  await expect(page).toHaveURL(/\/warehouse\/stock\?status=low$/);
});

test("новое движение видно в «Последних движениях»", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  await receive(request, store.id, product.id, 3);

  await page.goto("/warehouse");
  const recent = page.getByRole("region", { name: "Последние движения" });
  await expect(recent.getByText(product.name)).toBeVisible();
  await expect(recent).toContainText("+3");
});

test("черновик приёмки виден в плитке и на вкладке «Документы»", async ({ page, request }) => {
  const api = adminApi(request);
  const store = await createStore(request, uniqueStamp());
  const draft = await api.create<{ data: { id: number } }>("/admin/goods-receipts", { store_id: store.id });

  try {
    await page.goto("/warehouse");
    const tile = page.getByRole("link", { name: /Черновики/ });
    await expect(tile).toContainText(/[1-9]\d*/);
    await expect(
      page.getByRole("navigation", { name: "Разделы склада" }).getByRole("link", { name: /Документы/ }),
    ).toContainText(/[1-9]/);

    await tile.click();
    await expect(page).toHaveURL(/\/warehouse\/documents\?/);
  } finally {
    await api.delete(`/admin/goods-receipts/${draft.data.id}`);
    await api.delete(`/admin/stores/${store.id}`);
  }
});
