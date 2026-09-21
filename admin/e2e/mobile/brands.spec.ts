import { test, expect } from "@playwright/test";
import { adminApi } from "../adminApi";
import { ADMIN_SESSION } from "../session";

/**
 * Бренды на телефоне — образец справочника: форма в шторке снизу, тост над
 * нижней панелью, список карточками.
 */
test.use({ storageState: ADMIN_SESSION });

// Slug(и), заведённые текущим тестом — читается в afterEach.
let createdSlugs: string[] = [];

test.beforeEach(({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  createdSlugs = [];
});

/** Страховка, если тест упал раньше своего удаления. Тихая. */
test.afterEach(async ({ request }) => {
  const api = adminApi(request);
  const brands = await api.get<{ id: number; slug: string }[]>("/admin/brands");

  for (const brand of brands ?? []) {
    if (createdSlugs.includes(brand.slug)) {
      await api.delete(`/admin/brands/${brand.id}`);
    }
  }
});

test("форма бренда — шторка снизу, кнопки на виду, тост над панелью", async ({ page }) => {
  const slug = `e2e-m-brand-${Date.now()}`;
  createdSlugs.push(slug);

  await page.goto("/brands");
  await page.getByRole("button", { name: "Добавить бренд" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = (await dialog.boundingBox())!;
  // Шторка — во всю ширину и прижата к нижнему краю экрана.
  expect(box.width).toBeCloseTo(viewport.width, 0);
  expect(box.y + box.height).toBeCloseTo(viewport.height, 0);

  await dialog.getByLabel("Название (RU) *").fill("E2E мобильный бренд");
  await dialog.getByLabel("Slug *").fill(slug);
  const save = dialog.getByRole("button", { name: "Сохранить" });
  await expect(save).toBeInViewport();
  await save.click();
  await expect(dialog).toBeHidden();

  // Тост не прячется под нижней панелью.
  const toastBox = (await page.getByRole("status").getByRole("button", { name: "Сохранено" }).boundingBox())!;
  const navBox = (await page.getByRole("navigation", { name: "Основное меню" }).boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(navBox.y);
});

test("бренд виден карточкой по ролям колонок и удаляется из неё", async ({ page, request }) => {
  const slug = `e2e-m-card-${Date.now()}`;
  createdSlugs.push(slug);
  await adminApi(request).create("/admin/brands", { name: { ru: "E2E карточка бренда", kk: "" }, slug, is_active: true });

  await page.goto("/brands");

  // На телефоне таблицы нет вовсе — только карточки.
  await expect(page.getByRole("listitem").filter({ hasText: slug })).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);

  const card = page.getByRole("listitem").filter({ hasText: slug });
  await expect(card).toContainText("E2E карточка бренда");
  await expect(card).toContainText("Активен");
  // Роли убирают подписи: title, meta и badge выводятся без «Заголовок:», а ID скрыт.
  for (const label of ["ID", "Название", "Slug", "Статус"]) {
    await expect(card).not.toContainText(label);
  }

  await card.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: slug })).toHaveCount(0);
});
