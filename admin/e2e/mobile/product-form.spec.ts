import { test, expect } from "@playwright/test";
import { requireInStockProduct } from "../fixtures";
import { ADMIN_SESSION } from "../session";

/**
 * Карточка товара на телефоне: панель сохранения не прячется под нижнюю
 * навигацию, до нижних разделов добираются полосой переходов. Товар «в
 * наличии» только открывается — ничего не сохраняется.
 */
test.use({ storageState: ADMIN_SESSION });

test("панель сохранения над нижней навигацией", async ({ page }) => {
  await page.goto(`/products/${requireInStockProduct().id}`);

  const bar = page.getByRole("region", { name: "Сохранение" });
  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await expect(bar).toBeInViewport();
  await expect(bar.getByRole("button", { name: "Сохранить", exact: true })).toBeVisible();

  const barBox = (await bar.boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(navBox.y + 1);
});

test("«SEO» в полосе переходов раскрывает блок и прокручивает к нему", async ({ page }) => {
  await page.goto(`/products/${requireInStockProduct().id}`);

  await page.getByRole("navigation", { name: "Разделы" }).getByRole("button", { name: "SEO" }).click();

  await expect(page.getByRole("button", { name: /^SEO — адрес и поисковики/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByLabel("Адрес страницы")).toBeInViewport();
});

test("разделы идут одной лентой: основное, фото, цены, статус", async ({ page }) => {
  await page.goto(`/products/${requireInStockProduct().id}`);

  const top = async (id: string) => (await page.locator(`#${id}`).boundingBox())!.y;
  const order = [await top("basic"), await top("photos"), await top("price"), await top("status"), await top("catalog")];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
});
