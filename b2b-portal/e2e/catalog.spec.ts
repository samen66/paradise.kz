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

test("из каталога открывается карточка товара по id: оптовая цена и кнопка «В корзину»", async ({ page }) => {
  const product = requireInStockProduct();

  await page.goto(`/catalog?q=${encodeURIComponent(product.article)}`);
  const card = page.locator("article").filter({ hasText: product.article });
  await card.getByRole("link").first().click();

  // Портал адресует товар числовым id — slug в B2B API не принимается.
  await expect(page).toHaveURL(new RegExp(`/product/${product.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
  await expect(page.getByText(`Артикул: ${product.article}`)).toBeVisible();

  const info = page.locator("h1").locator("..");
  const prices = digitsOf((await info.innerText()).replace(product.article, "").replace(product.name, ""));
  expect(prices, `на карточке должна быть оптовая цена ${product.b2b_price} ₸`).toContain(String(product.b2b_price));
  expect(prices, `розничной цены ${product.retail_price} ₸ быть не должно`).not.toContain(String(product.retail_price));

  await expect(page.getByRole("button", { name: "В корзину" })).toBeVisible();
  await snap(page, "карточка товара портала");
});

test("старая ссылка на товар по slug показывает «Товар не найден»", async ({ page }) => {
  const product = requireInStockProduct();

  await page.goto(`/product/${product.slug}`);

  await expect(page.getByRole("heading", { name: "Товар не найден" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Вернуться в каталог" })).toBeVisible();
});
