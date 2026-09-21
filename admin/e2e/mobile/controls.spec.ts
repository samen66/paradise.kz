import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "../session";

/**
 * Мелочи, без которых админкой на телефоне неудобно пользоваться: шапка
 * экрана на виду, вкладки одной строкой, поля без зума iOS, кнопки под
 * палец, формы в одну колонку.
 */
test.use({ storageState: ADMIN_SESSION });

test("шапка экрана прилипает к верху при прокрутке", async ({ page }) => {
  await page.goto("/stock-movements");
  await page.waitForLoadState("networkidle");

  const heading = page.getByRole("heading", { level: 1, name: "Движения" });
  const header = heading.locator("xpath=../..");
  expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");

  // Проверка на прилипание при прокрутке имеет смысл только если страница
  // вообще выше вьюпорта — иначе прокрутка ничего не двигает и тест зелёный
  // просто потому, что нечего было проверять.
  expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(heading).toBeInViewport();
});

test("вкладки статусов заказа — одна строка, которая листается вбок", async ({ page }) => {
  await page.goto("/orders");

  const tablist = page.getByRole("tablist", { name: "Статус заказа" });
  await expect(tablist.getByRole("tab").first()).toBeVisible();

  const tops = await tablist
    .getByRole("tab")
    .evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  const { scrollWidth, clientWidth } = await tablist.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);
});

test("поле поиска 16px — iOS не зумит страницу при фокусе", async ({ page }) => {
  await page.goto("/orders");

  const fontSize = await page.getByRole("searchbox").evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe("16px");
});

test("кнопки не ниже 44px", async ({ page }) => {
  await page.goto("/brands");

  const box = (await page.getByRole("button", { name: "Добавить бренд" }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("вкладки статуса заказа не ниже 44px на телефоне", async ({ page }) => {
  await page.goto("/orders");

  const tablist = page.getByRole("tablist", { name: "Статус заказа" });
  await expect(tablist.getByRole("tab").first()).toBeVisible();
  const boxes = await tablist.getByRole("tab").evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().height));
  expect(boxes.length).toBeGreaterThan(0);
  for (const height of boxes) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
});

test("вкладка статуса из URL сразу видна в прокручиваемом ряду", async ({ page }) => {
  await page.goto("/orders?status=archived");

  const activeTab = page.getByRole("tablist", { name: "Статус заказа" }).getByRole("tab", { name: /Архив/ });
  await expect(activeTab).toBeInViewport();
});

test("действия строки товара видны без наведения на телефоне", async ({ page }) => {
  await page.goto("/products");

  const editLink = page.getByTitle("Редактировать").first();
  await expect(editLink).toBeVisible();
  const opacity = await editLink.evaluate((el) => getComputedStyle(el.parentElement!).opacity);
  expect(opacity).toBe("1");
});

test("поля формы приёмки идут в одну колонку", async ({ page }) => {
  await page.goto("/goods-receipts");
  await page.getByRole("button", { name: "Новая приёмка" }).click();

  const dialog = page.getByRole("dialog");
  const number = (await dialog.getByLabel("Номер", { exact: true }).boundingBox())!;
  const date = (await dialog.getByLabel("Дата приёмки").boundingBox())!;
  expect(Math.round(date.x)).toBe(Math.round(number.x));
  expect(date.y).toBeGreaterThan(number.y);

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
});
