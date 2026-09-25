import path from "node:path";
import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Вариант: характеристика из справочника (в том числе созданная прямо в окне
 * варианта) и фото, загруженное из окна варианта в галерею товара. Товар —
 * выключенный, свой; атрибуты — свои; всё удаляется в afterEach.
 */
test.use({ storageState: ADMIN_SESSION });

const PIXEL = path.join(__dirname, "assets/pixel.png");

let productIds: number[] = [];
let attributeIds: number[] = [];

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  productIds = [];
  attributeIds = [];
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);

  for (const id of productIds) {
    await api.delete(`/admin/products/${id}`);
  }
  for (const id of attributeIds) {
    await api.delete(`/admin/attributes/${id}`);
  }
});

test("вариант: характеристика, созданная в окне, и фото загрузкой", async ({ page, request }) => {
  const api = adminApi(request);
  const stamp = Date.now();
  const product = await api.create<{ data: { id: number } }>("/admin/products", { name: { ru: `E2E вариант ${stamp}` }, is_active: false });
  productIds.push(product.data.id);
  const colorName = `E2E цвет ${stamp}`;

  await page.goto(`/products/${product.data.id}`);
  await page.getByRole("button", { name: /^Варианты/ }).click();
  await page.getByRole("button", { name: "Добавить вариант" }).click();

  const variant = page.getByRole("dialog", { name: "Новый вариант" });
  await variant.getByLabel("Название *").fill("Серый");
  await variant.getByRole("button", { name: "+ Добавить характеристику" }).click();
  await variant.getByRole("combobox", { name: "Атрибут" }).fill(colorName);
  await variant.getByRole("option", { name: `+ Создать «${colorName}»` }).click();

  // Шторка поверх окна варианта: «Создать» не сохраняет вариант, Esc закрывает только её.
  const sheet = page.getByRole("dialog", { name: "Новый атрибут" });
  await sheet.getByRole("button", { name: "Создать" }).click();
  await expect(sheet).toBeHidden();
  await expect(variant).toBeVisible();
  await variant.getByLabel("Значение (RU)").fill("Графит");

  await variant.getByRole("button", { name: "+ Добавить характеристику" }).click();
  await variant.getByRole("combobox", { name: "Атрибут" }).nth(1).fill(`${colorName} второй`);
  await variant.getByRole("option", { name: `+ Создать «${colorName} второй»` }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Новый атрибут" })).toBeHidden();
  await expect(variant).toBeVisible();
  await variant.getByRole("button", { name: "Удалить характеристику" }).nth(1).click();

  await variant.getByLabel("Загрузить фото варианта").setInputFiles(PIXEL);
  await expect(variant.getByRole("button", { name: /1-е у варианта/ })).toBeVisible();
  await variant.getByRole("button", { name: "Сохранить" }).click();
  await expect(variant).toBeHidden();

  // Строка варианта: название и характеристики одной строкой под ним.
  await expect(page.getByText("Графит", { exact: true })).toBeVisible();
  await expect(page.getByTestId("product-image")).toHaveCount(1);

  const attributes = await api.get<{ data: { id: number; name: { ru?: string } }[] }>("/admin/attributes");
  attributeIds.push(...(attributes?.data ?? []).filter((a) => a.name.ru?.startsWith(colorName)).map((a) => a.id));
  const variants = await api.get<{ data: { images: { id: number }[]; attribute_values: unknown[] }[] }>(`/admin/products/${product.data.id}/variants`);
  expect(variants?.data[0].images).toHaveLength(1);
  expect(variants?.data[0].attribute_values).toHaveLength(1);
});
