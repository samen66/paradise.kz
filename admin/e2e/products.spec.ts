import { test, expect } from "@playwright/test";
import { requireProduct } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Список товаров.
 *
 * Главное, ради чего менеджер сюда смотрит, — колонка «Проблемы»: она отвечает
 * на вопрос «почему товара нет на витрине». Что API считает причины правильно,
 * прогон приёмки уже доказал (шаг 4); здесь проверяется, что причина
 * превратилась в читаемый бейдж, а не в голый код вроде `out_of_stock`.
 */
test.use({ storageState: ADMIN_SESSION });

test("у распроданного товара в списке виден бейдж «Нет остатка»", async ({ page }) => {
  const product = requireProduct();

  expect(product.stock, "прогон должен оставить товар распроданным — иначе бейджа не будет").toBe(0);

  await page.goto("/products");
  await page.getByPlaceholder("Поиск по названию или коду...").fill(product.article);

  const row = page.locator("tbody tr").filter({ hasText: product.article });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(product.name);
  await expect(row.getByText("Нет остатка")).toBeVisible();

  // Причина должна быть названа по-человечески: код из API на экран не попадает.
  await expect(row).not.toContainText("out_of_stock");
});

test("фильтр «только проблемные» не считает распроданность поломкой", async ({ page }) => {
  const product = requireProduct();

  await page.goto("/products");
  await page.getByPlaceholder("Поиск по названию или коду...").fill(product.article);
  await expect(page.locator("tbody tr").filter({ hasText: product.article })).toHaveCount(1);

  // Фильтр собирает товары, которые настроены неправильно (нет цены, ссылки,
  // категории, выключен, скрыт группой). Распроданный товар настроен верно —
  // иначе фильтр утонул бы в товарах, которые просто кончились.
  await page.getByLabel("Только проблемные").check();

  await expect(page.locator("tbody tr").filter({ hasText: product.article })).toHaveCount(0);
  await expect(page.getByText("Товары не найдены.")).toBeVisible();
});
