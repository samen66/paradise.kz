import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "../session";

/**
 * Раздел «Склад» на телефоне: вкладки одной строкой, «Склад» внизу
 * подсвечен в любом месте раздела, модалка из липкой шапки не прячется под
 * нижней панелью.
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» в нижней панели активен внутри раздела", async ({ page }) => {
  await page.goto("/warehouse/documents?kind=write_offs");
  const nav = page.getByRole("navigation", { name: "Основное меню" });
  await expect(nav.getByRole("link", { name: "Склад" })).toHaveAttribute("aria-current", "page");
});

test("вкладки раздела — одна строка", async ({ page }) => {
  await page.goto("/warehouse/stock");
  const tabs = page.getByRole("navigation", { name: "Разделы склада" }).getByRole("link");
  // Дождаться первой вкладки: сразу после goto экран ещё может показывать
  // ProtectedRoute-заглушку авторизации, и evaluateAll() её не дожидается.
  await expect(tabs.first()).toBeVisible();

  const tops = await tabs.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

test("модалка из шапки раздела — над нижней панелью", async ({ page }) => {
  await page.goto("/warehouse/stock");
  await page.getByRole("button", { name: /Принять товар/ }).click();

  const dialog = page.getByRole("dialog", { name: "Новая приёмка" });
  await expect(dialog).toBeVisible();

  // Кнопку видно — мало; проверяем, что в её центре именно она, а не нижняя панель.
  const save = dialog.getByRole("button", { name: "Сохранить" });
  const box = (await save.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.textContent?.trim() ?? null,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hit).toBe("Сохранить");

  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
});
