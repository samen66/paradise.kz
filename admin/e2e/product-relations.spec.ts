import path from "node:path";
import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { requireInStockProduct } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Вкладки карточки товара: фото и цены по типам. Всё созданное удаляется в
 * конце теста. Тип цены заводится свой, со случайным кодом, — существующие
 * retail/b2b не трогаются, так что цена на витрине не меняется.
 */
test.use({ storageState: ADMIN_SESSION });

// Что завёл текущий тест — читается в afterEach как страховка на случай
// падения раньше собственных шагов удаления через интерфейс.
// mediaGuard вооружается только когда снимок «до» надёжен (см. ниже) — иначе
// afterEach рискует стереть все фото уже существующего товара.
let mediaGuard: { productId: number; before: number[]; maxBeforeId: number } | null = null;
let priceTypeGuard: { productId: number; code: string } | null = null;

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  mediaGuard = null;
  priceTypeGuard = null;
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);

  if (mediaGuard) {
    const { productId, before, maxBeforeId } = mediaGuard;
    const media = await api.get<{ data: { id: number }[] }>(`/admin/products/${productId}/media`);

    for (const image of media?.data ?? []) {
      // Не в снимке "до" И новее любого снятого до загрузки — двойная
      // проверка на случай, если снимок "до" неполон (пагинация и т. п.).
      if (!before.includes(image.id) && image.id > maxBeforeId) {
        await api.delete(`/admin/products/${productId}/media/${image.id}`);
      }
    }
  }

  if (priceTypeGuard) {
    const { productId, code } = priceTypeGuard;
    const types = await api.get<{ data: { id: number; code: string }[] }>("/admin/price-types");
    const type = types?.data?.find((t) => t.code === code);

    if (type) {
      const prices = await api.get<{ data: { id: number; price_type_id: number }[] }>(`/admin/products/${productId}/prices`);

      for (const price of prices?.data ?? []) {
        if (price.price_type_id === type.id) {
          await api.delete(`/admin/products/${productId}/prices/${price.id}`);
        }
      }

      await api.delete(`/admin/price-types/${type.id}`);
    }
  }
});

test("фото загружается в товар и удаляется", async ({ page, request }) => {
  const product = requireInStockProduct();

  const api = adminApi(request);
  const before = await api.get<{ data: { id: number }[] }>(`/admin/products/${product.id}/media`);

  // Вооружаем страховку, только если снимок "до" точно снят: успешный ответ
  // с массивом data. Иначе (сбой запроса, неожиданная форма) afterEach не
  // должен трогать медиа вообще — лучше не подчистить тестовое фото, чем
  // случайно стереть все фото общего товара "в наличии".
  if (before && Array.isArray(before.data)) {
    const ids = before.data.map((i) => i.id);
    mediaGuard = { productId: product.id, before: ids, maxBeforeId: ids.length ? Math.max(...ids) : 0 };
  }

  await page.goto(`/products/${product.id}`);

  const images = page.getByTestId("product-image");
  const beforeCount = await images.count();

  await page.getByLabel("Загрузить фото").setInputFiles(path.join(__dirname, "assets/pixel.png"));
  await expect(images).toHaveCount(beforeCount + 1);

  await images.last().getByRole("button", { name: "Удалить" }).click();
  await expect(images).toHaveCount(beforeCount);
});

test("цена по своему типу добавляется, показывается в ₸ и удаляется", async ({ page }) => {
  const product = requireInStockProduct();
  const stamp = Date.now();
  const typeName = `E2E тип ${stamp}`;
  const code = `e2e_${stamp}`;
  priceTypeGuard = { productId: product.id, code };
  const dialog = page.getByRole("dialog");

  await page.goto("/price-types");
  await page.getByRole("button", { name: "Добавить тип цены" }).click();
  await dialog.getByLabel("Название *").fill(typeName);
  await dialog.getByLabel("Код *").fill(code);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(`/products/${product.id}`);
  const block = page.locator("#prices");
  await page.getByRole("button", { name: /^Цены по типам цен/ }).click();
  await block.getByRole("button", { name: "Добавить цену" }).click();
  await dialog.getByLabel("Тип цены *").selectOption({ label: typeName });
  await dialog.getByLabel("Цена, ₸ *").fill("1234.5");
  await dialog.getByRole("button", { name: "Сохранить" }).click();

  const row = block.locator("tbody tr").filter({ hasText: typeName });
  await expect(page.getByRole("button", { name: /^Цены по типам цен/ })).toContainText(/\d+ цен/);
  // toLocaleString('ru-RU') разделяет тысячи неразрывным пробелом.
  await expect(row).toContainText(/1\s234,5 ₸/);

  await row.getByRole("button", { name: "Удалить" }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/price-types");
  await page.locator("tbody tr").filter({ hasText: typeName }).getByRole("button", { name: "Удалить" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: typeName })).toHaveCount(0);
});
