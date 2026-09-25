import { test, expect, type Page } from "@playwright/test";
import { requireInStockProduct, requireProduct } from "./fixtures";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createProduct, createStore, receive, uniqueStamp } from "./warehouseApi";

/**
 * Вкладка «Остатки»: строка — товар, итог по местам хранения, статус,
 * разбивка по складам. Остаток только показывают — меняют его приёмки,
 * заказы и списания через FIFO-журнал.
 */
test.use({ storageState: ADMIN_SESSION });

const productRow = (page: Page, text: string) => page.locator("tbody tr").filter({ hasText: text });

async function search(page: Page, text: string) {
  await page.getByPlaceholder("Название, код или артикул").fill(text);
}

test("остаток товара из фикстур виден одной строкой", async ({ page }) => {
  const product = requireProduct();

  await page.goto("/warehouse/stock");
  await search(page, product.article);

  const row = productRow(page, product.article);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(product.name);
  await expect(row).toContainText(Number(product.stock).toLocaleString("ru-RU"));
});

test("товар в наличии виден с тем же остатком, что покупатель видит на витрине", async ({ page }) => {
  const product = requireInStockProduct();
  expect(product.stock, "прогон должен принять товар «в наличии» ровно на 7 шт").toBe(7);

  await page.goto("/warehouse/stock");
  await search(page, product.article);
  await expect(productRow(page, product.article)).toContainText("7");
});

test("товар на двух складах — одна строка с итогом, склады раскрываются", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const first = await createStore(request, stamp, " А");
  const second = await createStore(request, stamp, " Б");
  await receive(request, first.id, product.id, 4);
  await receive(request, second.id, product.id, 8);

  await page.goto("/warehouse/stock");
  await search(page, product.name);

  const row = productRow(page, product.name);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("12");

  await row.getByRole("button", { name: "Показать места хранения" }).click();
  const breakdown = page.getByRole("list", { name: `Места хранения: ${product.name}` });
  await expect(breakdown.getByText(first.name)).toBeVisible();
  await expect(breakdown.getByText(second.name)).toBeVisible();
});

test("мало — в «Заканчивается», ноль — в «Нет в наличии»", async ({ page, request }) => {
  const stamp = uniqueStamp();
  // Тот же stamp для обоих — параллельный воркер может успеть выставить свой
  // uniqueStamp() ровно на stamp + 1 (см. finding #5); различает суффикс.
  const low = await createProduct(request, stamp, { min_stock: 5 }, " А");
  const never = await createProduct(request, stamp, {}, " Б");
  const store = await createStore(request, stamp);
  await receive(request, store.id, low.id, 2);

  await page.goto("/warehouse/stock");
  const chips = page.getByRole("radiogroup", { name: "Статус остатка" });

  await search(page, low.name);
  await chips.getByRole("radio", { name: /Заканчивается/ }).click();
  await expect(page).toHaveURL(/status=low/);
  await expect(productRow(page, low.name)).toHaveCount(1);

  await chips.getByRole("radio", { name: /Нет в наличии/ }).click();
  await expect(productRow(page, low.name)).toHaveCount(0);

  await search(page, never.name);
  await expect(productRow(page, never.name)).toHaveCount(1);

  // Фильтр живёт в адресе: перезагрузка его не сбрасывает.
  await page.reload();
  await expect(chips.getByRole("radio", { name: /Нет в наличии/ })).toHaveAttribute("aria-checked", "true");
});

test("клик по чипу статуса во время дебаунса поиска не откатывает фильтр", async ({ page }) => {
  const stamp = uniqueStamp();

  await page.goto("/warehouse/stock");
  const chips = page.getByRole("radiogroup", { name: "Статус остатка" });

  await search(page, `E2E ${stamp}`);
  // Клик — пока 300-мс таймер дебаунса поиска ещё не выстрелил: адрес не
  // должен откатиться к состоянию до клика, когда дебаунс всё же сработает.
  await chips.getByRole("radio", { name: /Нет в наличии/ }).click();
  await expect(page).toHaveURL(/status=out/);

  // Дождаться, пока дебаунс допишет search= в адрес, и проверить, что
  // status=out при этом никуда не делся.
  await expect(page).toHaveURL(/search=/);
  await expect(page).toHaveURL(/status=out/);
});

test("неизвестные параметры адреса не ломают экран", async ({ page }) => {
  await page.goto("/warehouse/stock?status=foo&sort=zzz");

  await expect(
    page.getByRole("radiogroup", { name: "Статус остатка" }).getByRole("radio", { name: /Все/ }),
  ).toHaveAttribute("aria-checked", "true");
  // Строки скелета тоже видны в tbody — дождаться конца загрузки, иначе
  // проверка прошла бы и на сломанном экране.
  await expect(page.locator("table[aria-busy='false']")).toBeVisible();
  await expect(page.getByText("Не удалось загрузить")).toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toBeVisible();
});

test("ссылка «Движения» из строки открывает журнал этого товара", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  await receive(request, store.id, product.id, 1);

  await page.goto("/warehouse/stock");
  await search(page, product.name);
  await productRow(page, product.name).getByRole("link", { name: "Движения" }).click();

  await expect(page).toHaveURL(new RegExp(`/warehouse/movements\\?product_id=${product.id}`));
  await expect(page.locator("tbody tr").filter({ hasText: product.name })).toHaveCount(1);
});

test("без активного склада обзор показывает красную плашку", async ({ page }) => {
  // Реальные цифры остаются реальными: подменяется только флаг.
  await page.route("**/api/admin/stock/summary*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();

    await route.fulfill({ response, json: { data: { ...json.data, has_active_store: false } } });
  });

  await page.goto("/warehouse");

  await expect(page.getByText("Нет ни одного активного склада.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Настроить места хранения/ })).toBeVisible();
});

test("«⋯ → Принять товар» открывает приёмку с этим товаром на выбранном складе", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const product = await createProduct(request, stamp);
  const store = await createStore(request, stamp);
  await receive(request, store.id, product.id, 1);

  await page.goto(`/warehouse/stock?store_id=${store.id}`);
  await page.getByPlaceholder("Название, код или артикул").fill(product.name);
  await page.getByRole("button", { name: `Действия: ${product.name}` }).click();
  await page.getByRole("menuitem", { name: "Принять товар" }).click();

  await expect(page).toHaveURL(/\/warehouse\/receipts\/\d+$/);
  const receiptId = new URL(page.url()).pathname.split("/").pop();
  try {
    await expect(page.getByTestId("document-line").filter({ hasText: product.name })).toHaveCount(1);
    await expect(page.getByTestId("document-fields")).toContainText(store.name);
  } finally {
    await adminApi(request).delete(`/admin/goods-receipts/${receiptId}`);
  }
});
