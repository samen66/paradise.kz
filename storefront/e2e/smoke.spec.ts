import { test, expect, type Page } from "@playwright/test";
import { requireProduct } from "./fixtures";

/**
 * Смоук витрины B2C.
 *
 * Здесь проверяется ровно одно: что состояние, которое прогон приёмки уже
 * доказал в базе и в API, видно человеку на экране. Остатки, суммы и статусы
 * не перепроверяются — это делает `php artisan mvp:acceptance`, быстрее и
 * надёжнее любого браузера.
 *
 * Товар прогона к концу выкуплен до нуля (сценарий 5 чеклиста), поэтому он же
 * служит образцом распроданного.
 */

/** Карточка товара в каталоге. Артикул прогона уникален, так что карточка одна. */
function productCard(page: Page, article: string) {
  return page.locator("article").filter({ hasText: article });
}

test.describe("Витрина", () => {
  test("главная открывается", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Paradise/i);
  });

  test("несуществующий адрес отдаёт 404", async ({ page }) => {
    const response = await page.goto("/etoy-stranitsy-net");

    expect(response?.status()).toBe(404);
  });

  test("каталог открывается и находит товар прогона", async ({ page }) => {
    const product = requireProduct();

    await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(productCard(page, product.article)).toHaveCount(1);
  });

  test("карточка товара открывается из каталога", async ({ page }) => {
    const product = requireProduct();

    await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);
    await productCard(page, product.article).getByRole("link", { name: product.name }).click();

    await expect(page).toHaveURL(new RegExp(`/product/${product.slug}$`));
    await expect(page.getByRole("heading", { name: product.name }).first()).toBeVisible();
  });

  test("распроданный товар в каталоге помечен «Нет в наличии» и без кнопки в корзину", async ({ page }) => {
    const product = requireProduct();

    expect(product.stock, "прогон должен оставить товар распроданным — иначе проверять нечего").toBe(0);

    await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);

    const card = productCard(page, product.article);
    await expect(card).toContainText("Нет в наличии");
    await expect(card.getByRole("button", { name: "В корзину" })).toHaveCount(0);
  });

  test("на карточке распроданного товара кнопка заказа неактивна", async ({ page }) => {
    const product = requireProduct();

    // Кнопка «Нет в наличии» живёт в нижней панели карточки, а она мобильная
    // (lg:hidden). На десктопе у распроданного товара кнопки заказа нет вовсе —
    // это следующий тест.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/product/${product.slug}`);

    const soldOut = page.getByRole("button", { name: "Нет в наличии" });
    await expect(soldOut).toBeVisible();
    await expect(soldOut).toBeDisabled();
    await expect(page.getByRole("button", { name: "В корзину" })).toHaveCount(0);
  });

  test("на десктопе распроданный товар предлагают под заказ, а не в корзину", async ({ page }) => {
    const product = requireProduct();

    await page.goto(`/product/${product.slug}`);

    await expect(page.getByText("Нет на складе")).toBeVisible();
    await expect(page.getByRole("button", { name: "В корзину" })).toHaveCount(0);
  });
});
