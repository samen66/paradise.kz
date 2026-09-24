import { test, expect } from "@playwright/test";
import { NAV_GROUPS } from "../../src/components/shell/navConfig";
import { ADMIN_SESSION } from "../session";

/**
 * Каркас на телефоне: нижняя панель вместо сайдбара, меню «Ещё» со всеми
 * разделами, выход.
 */
test.use({ storageState: ADMIN_SESSION });

test("нижняя панель переключает разделы и подсвечивает текущий", async ({ page }) => {
  await page.goto("/orders");

  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await expect(nav.getByRole("link", { name: "Заказы" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Товары" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(nav.getByRole("link", { name: "Товары" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Заказы" })).not.toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "Ещё" })).toHaveAttribute("data-active", "false");

  // Сайдбар на телефоне не рисуется — иначе он съел бы 256 из 412 px.
  await expect(page.getByText("Paradise Admin", { exact: true })).toBeHidden();
});

test("«Ещё» показывает все разделы и ведёт в них", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("button", { name: "Ещё" }).click();

  const sheet = page.getByRole("dialog", { name: "Все разделы" });
  for (const link of NAV_GROUPS.flatMap((group) => group.links)) {
    await expect(sheet.getByRole("link", { name: link.label, exact: true })).toBeVisible();
  }
  await expect(sheet.getByRole("button", { name: "Выйти" })).toBeVisible();

  await sheet.getByRole("link", { name: "Категории", exact: true }).click();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(sheet).toBeHidden();

  // Раздел не из четырёх главных — подсвечено «Ещё».
  await expect(page.getByRole("button", { name: "Ещё" })).toHaveAttribute("data-active", "true");
});

test("меню «Ещё» закрывается крестиком и Escape", async ({ page }) => {
  await page.goto("/orders");
  const more = page.getByRole("button", { name: "Ещё" });
  const sheet = page.getByRole("dialog", { name: "Все разделы" });

  await more.click();
  await sheet.getByRole("button", { name: "Закрыть меню" }).click();
  await expect(sheet).toBeHidden();

  await more.click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("«назад» после перехода из «Ещё» закрывает меню", async ({ page }) => {
  await page.goto("/orders");

  await page.getByRole("navigation", { name: "Основное меню" }).getByRole("link", { name: "Товары" }).click();
  await expect(page).toHaveURL(/\/products$/);

  await page.getByRole("button", { name: "Ещё" }).click();
  const sheet = page.getByRole("dialog", { name: "Все разделы" });
  await expect(sheet).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(sheet).toBeHidden();

  // Регрессия: «назад» не проходит через onClose, поэтому обычный повторный
  // переход на тот же маршрут не должен снова показать меню.
  await page.getByRole("navigation", { name: "Основное меню" }).getByRole("link", { name: "Товары" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(sheet).toBeHidden();
});

test("«Выйти» из меню ведёт на вход", async ({ page }) => {
  // Выход только стирает токен из localStorage этого контекста — сессия
  // остальных тестов (файл ADMIN_SESSION) не страдает.
  await page.goto("/orders");
  await page.getByRole("button", { name: "Ещё" }).click();
  await page.getByRole("dialog", { name: "Все разделы" }).getByRole("button", { name: "Выйти" }).click();

  await expect(page).toHaveURL(/\/login$/);
});
