import { test, expect } from "@playwright/test";
import { B2B_SESSION } from "./session";
import { requireInStockProduct, requireProduct } from "./fixtures";
import { snap } from "./shop";

/**
 * Оптовый каталог под одобренным клиентом.
 *
 * То, ради чего портал вообще отдельный: партнёр видит свою цену. Что API
 * отдаёт именно `b2b_price`, прогон приёмки уже доказал (шаг 20) — здесь
 * проверяется, что эта цена доехала до экрана, а розничная на него не попала.
 */
test.use({ storageState: B2B_SESSION });

// Карточки товара портала здесь нет намеренно: /product/{slug} в b2b-portal
// сейчас не открывается — страница просит у API /api/products/{slug}, а этот
// маршрут принимает только id и отдаёт 404. Пока это не починено в приложении,
// теста на неё не будет: вечно красный тест хуже отсутствующего.

/** Цена в карточке — Intl с валютой, пробелы внутри неразрывные. Сравниваем по цифрам. */
function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

test("каталог открывается и показывает оптовую цену, а не розничную", async ({ page }) => {
  const product = requireProduct();

  await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);

  const card = page.locator("article").filter({ hasText: product.article });
  await expect(card).toHaveCount(1);

  const prices = digitsOf((await card.innerText()).replace(product.article, ""));
  expect(prices, `в карточке должна быть оптовая цена ${product.b2b_price} ₸`).toContain(
    String(product.b2b_price),
  );
  expect(prices, `розничной цены ${product.retail_price} ₸ в портале быть не должно`).not.toContain(
    String(product.retail_price),
  );
});

test("товар в наличии показывает партнёру число на складе и кнопку «В корзину»", async ({ page }) => {
  const product = requireInStockProduct();

  // Этот товар никто не покупает — на экране ровно столько, сколько принял прогон.
  expect(product.stock, "прогон должен принять товар «в наличии» ровно на 7 шт").toBe(7);

  await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);

  const card = page.locator("article").filter({ hasText: product.article });
  await expect(card).toContainText(`В наличии: ${product.stock} шт.`);
  await expect(card).not.toContainText("Нет в наличии");
  await expect(card.getByRole("button", { name: "В корзину" })).toBeVisible();

  await snap(page, "оптовый каталог: товар в наличии");
});

test("распроданный товар портал тоже помечает «Нет в наличии»", async ({ page }) => {
  const product = requireProduct();

  expect(product.stock, "прогон должен оставить товар распроданным — иначе проверять нечего").toBe(0);

  await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);

  const card = page.locator("article").filter({ hasText: product.article });
  await expect(card).toContainText("Нет в наличии");
  await expect(card.getByRole("button", { name: "В корзину" })).toHaveCount(0);
});
