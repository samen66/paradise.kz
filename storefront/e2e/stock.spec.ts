import { test, expect } from "@playwright/test";
import { loadFixtures, requireInStockProduct, requireProduct } from "./fixtures";
import { productCard, snap } from "./shop";

/**
 * Остатки глазами покупателя.
 *
 * Прогон приёмки оставляет рядом два товара: распроданный (товар прогона) и
 * «в наличии» ровно на 7 шт. Второй никто из тестов не покупает, так что число
 * на экране обязано быть ровно семёркой — без обращения к API, прямо по
 * фикстурам. Если здесь видно другое число, витрина показывает не тот остаток.
 *
 * Товар «для заказа» тут не проверяется: его покупают тесты оформления, и
 * его число живёт в checkout.spec.ts.
 */

test.describe("Остатки в каталоге", () => {
  test("в каталоге рядом видно: в наличии с числом и распроданный", async ({ page }) => {
    const fixtures = loadFixtures();
    const inStock = requireInStockProduct();
    const soldOut = requireProduct();

    expect(inStock.stock, "прогон должен принять товар «в наличии» ровно на 7 шт").toBe(7);
    expect(soldOut.stock, "прогон должен оставить товар прогона распроданным").toBe(0);

    // По метке прогона находятся все его товары — одна выдача, оба состояния рядом.
    await page.goto(`/catalog?q=${encodeURIComponent(fixtures.run_token)}`);

    // Кнопки «В корзину» у карточек каталога нет ни у кого (CatalogView рисует
    // их с showAddToCart={false}) — различаются они только плашкой остатка.
    const inStockCard = productCard(page, inStock.article);
    await expect(inStockCard).toContainText(`В наличии: ${inStock.stock} шт.`);
    await expect(inStockCard).not.toContainText("Нет в наличии");

    const soldOutCard = productCard(page, soldOut.article);
    await expect(soldOutCard).toContainText("Нет в наличии");
    await expect(soldOutCard).not.toContainText("В наличии:");

    await snap(page, "каталог: в наличии и распроданный");
  });

  test("«Только в наличии» убирает распроданный товар и оставляет товар в наличии", async ({ page }) => {
    const fixtures = loadFixtures();
    const inStock = requireInStockProduct();
    const soldOut = requireProduct();

    await page.goto(`/catalog?q=${encodeURIComponent(fixtures.run_token)}`);
    await expect(productCard(page, soldOut.article)).toHaveCount(1);

    // Чекбокс управляемый: отмечается, когда фильтр доехал до адреса, поэтому click, а не check.
    await page.getByRole("checkbox", { name: "Только в наличии" }).click();

    await expect(page).toHaveURL(/in_stock=1/);
    await expect(productCard(page, soldOut.article)).toHaveCount(0);
    await expect(productCard(page, inStock.article)).toContainText(`В наличии: ${inStock.stock} шт.`);
    await expect(page.getByRole("checkbox", { name: "Только в наличии" })).toBeChecked();

    await snap(page, "каталог: фильтр «Только в наличии»");
  });
});

test.describe("Остатки на странице товара", () => {
  test("на десктопе видно число в наличии и активную кнопку «В корзину»", async ({ page }) => {
    const inStock = requireInStockProduct();

    await page.goto(`/product/${inStock.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: inStock.name })).toBeVisible();
    await expect(page.getByText(`В наличии — ${inStock.stock} шт`)).toBeVisible();
    await expect(page.getByRole("button", { name: "В корзину" })).toBeEnabled();
    await expect(page.getByText("Нет на складе")).toHaveCount(0);

    await snap(page, "страница товара в наличии, десктоп");
  });

  test("на телефоне нижняя панель предлагает «В корзину», а не «Нет в наличии»", async ({ page }) => {
    const inStock = requireInStockProduct();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/product/${inStock.slug}`);

    // На телефоне кнопок две: в карточке покупки и в нижней панели. Панель — последняя.
    const stickyBar = page.getByRole("button", { name: "В корзину" }).last();
    await expect(stickyBar).toBeVisible();
    await expect(stickyBar).toBeEnabled();
    await expect(page.getByRole("button", { name: "Нет в наличии" })).toHaveCount(0);

    await snap(page, "страница товара в наличии, телефон");
  });
});

test.describe("Остаток в корзине", () => {
  test("больше, чем есть на складе, оформить нельзя; ровно столько — можно", async ({ page }) => {
    const inStock = requireInStockProduct();

    await page.goto(`/product/${inStock.slug}`);
    await page.getByRole("button", { name: "В корзину" }).click();
    await expect(page.getByRole("button", { name: "Добавлено" })).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { level: 1, name: "Корзина" })).toBeVisible();
    // Первые сверки уходят сами — при открытии и когда подъедут настройки со складом.
    await page.waitForLoadState("networkidle");

    const checkout = page.getByRole("link", { name: "Оформить заказ" });
    const plus = page.getByRole("button", { name: "+", exact: true });
    const minus = page.getByRole("button", { name: "−", exact: true });

    // Корзина сверяет каждое изменение с API. Щёлкаем по одному и ждём ответ,
    // иначе ответы на 7 и 8 шт могут прийти не по порядку и экран покажет
    // устаревшую сверку.
    const validated = () => page.waitForResponse((r) => r.url().includes("/public/cart/validate") && r.ok());

    for (let quantity = 2; quantity <= inStock.stock + 1; quantity++) {
      await Promise.all([validated(), plus.click()]);
    }

    await expect(page.getByText("Недостаточно на складе")).toBeVisible();
    await expect(checkout).toHaveAttribute("aria-disabled", "true");
    await snap(page, `корзина: ${inStock.stock + 1} шт при остатке ${inStock.stock}`);

    await Promise.all([validated(), minus.click()]);

    await expect(page.getByText("Недостаточно на складе")).toHaveCount(0);
    await expect(page.getByText("В наличии", { exact: true })).toBeVisible();
    await expect(checkout).toHaveAttribute("aria-disabled", "false");
    await snap(page, `корзина: ${inStock.stock} шт при остатке ${inStock.stock}`);
  });
});
