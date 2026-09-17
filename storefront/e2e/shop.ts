import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Общие куски браузерных тестов витрины: карточка в каталоге, цена так, как её
 * пишет formatPrice, снимки экрана в отчёт и обращения к API там, где тесту
 * нужно знать правду помимо экрана.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

/** Карточка товара в каталоге. Артикулы прогона уникальны и не вложены друг в друга. */
export function productCard(page: Page, article: string) {
  return page.locator("article").filter({ hasText: article });
}

/**
 * Цена так, как её рисует `formatPrice` витрины («500 000 ₸»). Пробелы внутри —
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

/**
 * Снимок всей страницы — в HTML-отчёт Playwright (`npx playwright show-report`).
 * Ради них тесты и зовутся визуальными: по снимкам шагов видно, что именно
 * было на экране, когда проверка прошла или упала.
 */
export async function snap(page: Page, name: string): Promise<void> {
  await test.info().attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

/**
 * Одноразовый телефон гостя. Гостевой чекаут заводит учётку на номер, а
 * users.phone уникальный. Блок +7 700 01X XXXX — соседний с тем, что берёт
 * прогон приёмки (+7 700 00X XXXX), так что с его номерами не пересечётся.
 */
export function guestPhone(): string {
  const suffix = (Date.now() + Math.floor(Math.random() * 100_000)) % 100_000;

  return `+770001${String(suffix).padStart(5, "0")}`;
}

/** Остаток товара, который прямо сейчас отдаёт публичный API, — без кэша витрины. */
export async function apiStock(request: APIRequestContext, slug: string): Promise<number> {
  const response = await request.get(`${API_URL}/public/products/${slug}`, {
    headers: { Accept: "application/json" },
  });

  expect(response.status(), `GET /public/products/${slug}`).toBe(200);

  const { data } = (await response.json()) as { data: { stock?: number; in_stock: boolean } };

  expect(data.stock, "API не отдаёт число остатка — проверьте show_stock_quantity в настройках каталога").toBeDefined();

  return Number(data.stock);
}

/**
 * Заказ «от другого покупателя» — мимо браузера, прямо в API. Нужен там, где
 * проверяется реакция витрины на то, что товар купили, пока страница открыта.
 */
export async function placeGuestOrder(
  request: APIRequestContext,
  { productId, storeId, quantity }: { productId: number; storeId: number; quantity: number },
): Promise<string> {
  const response = await request.post(`${API_URL}/public/checkout`, {
    headers: { Accept: "application/json" },
    data: {
      name: "ACC Другой покупатель e2e",
      phone: guestPhone(),
      payment_method: "cash",
      store_id: storeId,
      items: [{ product_id: productId, quantity }],
    },
  });

  expect(response.status(), `POST /public/checkout: ${await response.text()}`).toBe(201);

  const { data } = (await response.json()) as { data: { number: string } };

  return data.number;
}
