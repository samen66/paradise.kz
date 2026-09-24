import { test, expect, type Page } from "@playwright/test";
import { NAV_GROUPS } from "../../src/components/shell/navConfig";
import { adminApi } from "../adminApi";
import { requireInStockProduct, requireOrder } from "../fixtures";
import { ADMIN_SESSION } from "../session";

/**
 * Главная мобильная поломка — страница, которая ездит вбок. Проверяется
 * каждый раздел меню и по одному документу каждого вида.
 *
 * Смотрим и на документ, и на `<main>`: до мобильной версии прокручивался
 * не документ, а `<main>` внутри `h-screen overflow-hidden`, и проверка
 * одного документа прошла бы на сломанной вёрстке. Собственные полосы
 * прокрутки внутри страницы (ряд вкладок, широкая таблица в
 * `overflow-x-auto`) разрешены — это не страница.
 */
test.use({ storageState: ADMIN_SESSION });

async function horizontalOverflow(page: Page): Promise<string[]> {
  await page.waitForLoadState("networkidle");

  return page.evaluate(() => {
    const problems: string[] = [];
    const doc = document.documentElement;
    const main = document.querySelector("main");

    if (doc.scrollWidth > window.innerWidth) {
      problems.push(`документ: ${doc.scrollWidth} > ${window.innerWidth}`);
    }
    if (main && main.scrollWidth > main.clientWidth) {
      problems.push(`main: ${main.scrollWidth} > ${main.clientWidth}`);
    }

    return problems;
  });
}

const ROUTES = [...new Set(NAV_GROUPS.flatMap((group) => group.links.map((link) => link.href)))];
const WAREHOUSE_ROUTES = [
  "/warehouse/stock",
  "/warehouse/movements",
  "/warehouse/documents?kind=receipts",
  "/warehouse/documents?kind=write_offs",
];

for (const route of [...ROUTES, ...WAREHOUSE_ROUTES]) {
  test(`${route} не прокручивается вбок`, async ({ page }) => {
    await page.goto(route);
    expect(await horizontalOverflow(page)).toEqual([]);
  });
}

type ListBody = { id: number }[] | { data?: { id: number }[] } | null;

const firstId = (body: ListBody): number | undefined => (Array.isArray(body) ? body[0]?.id : body?.data?.[0]?.id);

test("документы не прокручиваются вбок", async ({ page, request }) => {
  const api = adminApi(request);
  const routes = [`/orders/${requireOrder("buyout").id}`, `/products/${requireInStockProduct().id}`];

  // Этих документов может не быть на свежей базе — тогда их просто пропускаем.
  const lists = [
    ["/admin/goods-receipts", "/warehouse/receipts"],
    ["/admin/write-offs", "/warehouse/write-offs"],
    ["/admin/catalog-groups", "/catalog-groups"],
    ["/admin/product-collections", "/product-collections"],
  ] as const;

  for (const [endpoint, prefix] of lists) {
    const id = firstId(await api.get<ListBody>(endpoint));
    if (id !== undefined) {
      routes.push(`${prefix}/${id}`);
    }
  }

  for (const route of routes) {
    await page.goto(route);
    expect.soft(await horizontalOverflow(page), route).toEqual([]);
  }
});
