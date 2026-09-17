import { test, type Page } from "@playwright/test";

/**
 * Общие куски браузерных тестов портала. Та же логика, что в
 * storefront/e2e/shop.ts, — приложения независимы, общего пакета у них нет.
 */

/** Карточка товара в каталоге. Артикулы прогона уникальны и не вложены друг в друга. */
export function productCard(page: Page, article: string) {
  return page.locator("article").filter({ hasText: article });
}

/**
 * Цена так, как её рисует `formatPrice` («400 000 ₸»). Пробелы внутри —
 * неразрывные, и какие именно, зависит от ICU браузера, поэтому в выражении
 * на их месте любой пробельный символ.
 */
export function price(amount: number): RegExp {
  const formatted = new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(amount);

  return new RegExp(formatted.replace(/\s/g, "\\s"));
}

/** Снимок всей страницы — в HTML-отчёт Playwright (`npx playwright show-report`). */
export async function snap(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

/** Число из плашки «В наличии: N шт.» в карточке каталога. */
export async function stockInCard(page: Page, article: string): Promise<number> {
  const text = await productCard(page, article).getByText(/^В наличии: \d+ шт\.$/).innerText();

  return Number(text.replace(/\D/g, ""));
}
