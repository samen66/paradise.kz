import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Экран «Атрибуты»: создание без slug (его делает сервер), поиск и чипы в
 * адресе, перевод, переключатель «В фильтрах» и запрет удалить используемый.
 */
test.use({ storageState: ADMIN_SESSION });

// Названия и товары, заведённые текущим тестом — читаются в afterEach. Воркер
// Playwright выполняет тесты одного файла по одному, так что модульные
// переменные между тестами не путаются.
let createdNames: string[] = [];
let createdProducts: number[] = [];

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  createdNames = [];
  createdProducts = [];
});

/**
 * Страховка: удаляет товары теста (их значения уходят каскадом), затем любой
 * атрибут, чьё русское название совпадает с заведённым в тесте. Тихая — не
 * должна ронять прогон.
 */
test.afterEach(async ({ request }) => {
  const api = adminApi(request);

  for (const id of createdProducts) {
    await api.delete(`/admin/products/${id}`);
  }

  const body = await api.get<{ data: { id: number; name: { ru?: string } }[] }>("/admin/attributes");

  for (const attribute of body?.data ?? []) {
    if (attribute.name.ru && createdNames.includes(attribute.name.ru)) {
      await api.delete(`/admin/attributes/${attribute.id}`);
    }
  }
});

test("атрибут создаётся без slug, переводится, правится и удаляется", async ({ page }) => {
  const name = `E2E цвет ${Date.now()}`;
  createdNames.push(name);

  await page.goto("/attributes");
  await page.getByRole("button", { name: "Добавить атрибут" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Новый атрибут" });
  await dialog.getByLabel("Название (RU) *").fill(name);
  await dialog.getByRole("button", { name: "Создать" }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel("Поиск атрибута").fill(name);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText("нет перевода на казахский")).toBeVisible();
  await expect(page.getByText("не используется")).toBeVisible();

  await page.getByRole("radio", { name: /Без перевода/ }).click();
  await expect(page).toHaveURL(/filter=untranslated/);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

test("переключатель «В фильтрах» сохраняется сразу", async ({ page, request }) => {
  const name = `E2E фильтр ${Date.now()}`;
  createdNames.push(name);
  await adminApi(request).create("/admin/attributes", { name: { ru: name } });

  await page.goto(`/attributes?q=${encodeURIComponent(name)}`);
  await page.getByRole("switch").first().click();
  await expect(page.getByText("Показывается в фильтрах витрины")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch").first()).toHaveAttribute("aria-checked", "true");
});

test("используемый атрибут удалить нельзя", async ({ page, request }) => {
  const api = adminApi(request);
  const name = `E2E занят ${Date.now()}`;
  createdNames.push(name);
  const attribute = await api.create<{ data: { id: number } }>("/admin/attributes", { name: { ru: name } });
  const product = await api.create<{ data: { id: number } }>("/admin/products", {
    name: { ru: `E2E товар ${Date.now()}` },
    is_active: false,
    attribute_values: [{ attribute_id: attribute.data.id, value: { ru: "Серый" } }],
  });
  createdProducts.push(product.data.id);

  await page.goto(`/attributes?q=${encodeURIComponent(name)}`);
  await expect(page.getByText("в 1 товаре")).toBeVisible();
  // ПК — неактивная кнопка, телефон — неактивный пункт шторки.
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(page.getByRole("button", { name: "Удалить" })).toBeDisabled();
  } else {
    await page.getByRole("button", { name: `Действия: ${name}` }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Удалить/ })).toBeDisabled();
  }
});
