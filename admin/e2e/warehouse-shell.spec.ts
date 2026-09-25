import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Раздел «Склад»: один вход, вкладки, прежние адреса ведут сюда же.
 *
 * Шесть пунктов меню «Запасы» свернулись в один. Старые адреса живут в
 * закладках и в ссылках из уведомлений — редирект обязан донести и
 * параметры, иначе «движения этого документа» превратятся во «все движения».
 */
test.use({ storageState: ADMIN_SESSION });

test("вкладки ведут по разделу", async ({ page }) => {
  await page.goto("/warehouse");
  await expect(page).toHaveURL(/\/warehouse$/);
  await expect(page.getByRole("heading", { level: 1, name: "Склад" })).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Разделы склада" });
  await tabs.getByRole("link", { name: "Остатки" }).click();
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
  await expect(tabs.getByRole("link", { name: "Остатки" })).toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "Движения" }).click();
  await expect(page).toHaveURL(/\/warehouse\/movements$/);
  await expect(tabs.getByRole("link", { name: "Движения" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Остатки" })).not.toHaveAttribute("aria-current", "page");
});

test("старые адреса ведут в новый раздел с параметрами", async ({ page }) => {
  const cases: [string, RegExp][] = [
    ["/stock", /\/warehouse\/stock$/],
    ["/stock-movements?type=receipt", /\/warehouse\/movements\?type=receipt$/],
    ["/stock-movements?document=receipt:1", /\/warehouse\/movements\?document=receipt(%3A|:)1$/],
  ];

  for (const [from, to] of cases) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }

  // Параметр дошёл до экрана, а не только до адреса.
  await expect(page.getByText("Показаны движения одного документа.")).toBeVisible();
});

test("«Склад» в меню ведёт в раздел", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("link", { name: "Склад", exact: true }).first().click();
  await expect(page).toHaveURL(/\/warehouse$/);
});

test("вкладка «Документы» переключает приёмки и списания", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("navigation", { name: "Разделы склада" }).getByRole("link", { name: "Документы" }).click();
  await expect(page).toHaveURL(/\/warehouse\/documents\?kind=receipts$/);

  const kinds = page.getByRole("navigation", { name: "Вид документов" });
  await expect(kinds.getByRole("link", { name: "Приёмки" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Поставщик" })).toBeVisible();

  await kinds.getByRole("link", { name: "Списания" }).click();
  await expect(page).toHaveURL(/kind=write_offs$/);
  await expect(page.getByRole("columnheader", { name: "Причина" })).toBeVisible();
});

test("неизвестный вид документов показывает приёмки", async ({ page }) => {
  await page.goto("/warehouse/documents?kind=foo");
  await expect(
    page.getByRole("navigation", { name: "Вид документов" }).getByRole("link", { name: "Приёмки" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Поставщик" })).toBeVisible();
});

test("старые адреса документов ведут в раздел", async ({ page, request }) => {
  const cases: [string, RegExp][] = [
    ["/goods-receipts", /\/warehouse\/documents\?kind=receipts$/],
    ["/write-offs?status=draft", /\/warehouse\/documents\?(kind=write_offs&status=draft|status=draft&kind=write_offs)$/],
  ];
  for (const [from, to] of cases) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }

  // Старая ссылка на конкретный документ.
  const api = adminApi(request);
  const store = await api.create<{ data: { id: number } }>("/admin/stores", { name: `E2E склад ${Date.now()}`, is_active: false });
  const receipt = await api.create<{ data: { id: number } }>("/admin/goods-receipts", { store_id: store.data.id });
  try {
    await page.goto(`/goods-receipts/${receipt.data.id}`);
    await expect(page).toHaveURL(new RegExp(`/warehouse/receipts/${receipt.data.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: `Приёмка №${receipt.data.id}` })).toBeVisible();
  } finally {
    await api.delete(`/admin/goods-receipts/${receipt.data.id}`);
    await api.delete(`/admin/stores/${store.data.id}`);
  }
});

test("справочники открываются из шапки и переключаются", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("link", { name: "Справочники" }).click();

  await expect(page).toHaveURL(/\/warehouse\/stores$/);
  await expect(page.getByRole("heading", { level: 1, name: "Справочники" })).toBeVisible();
  const dirs = page.getByRole("navigation", { name: "Справочники склада" });
  await expect(dirs.getByRole("link", { name: "Места хранения" })).toHaveAttribute("aria-current", "page");

  await dirs.getByRole("link", { name: "Поставщики" }).click();
  await expect(page).toHaveURL(/\/warehouse\/suppliers$/);

  await page.getByRole("link", { name: "Назад" }).click();
  await expect(page).toHaveURL(/\/warehouse$/);
});

test("старые адреса справочников ведут в раздел", async ({ page }) => {
  await page.goto("/stores");
  await expect(page).toHaveURL(/\/warehouse\/stores$/);
  await page.goto("/suppliers");
  await expect(page).toHaveURL(/\/warehouse\/suppliers$/);
});
