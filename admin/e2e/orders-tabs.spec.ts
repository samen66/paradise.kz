import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Регрессия финального ревью (F1): между `md` и `lg` (например 1024 px) семь
 * вкладок статуса заказа с бейджами счётчиков (~870 px) не помещаются в
 * колонку контента (~700 px). Строка не должна ни листаться, ни обрезать
 * вкладки — на десктопе она переносится, как раньше.
 */
test.use({ storageState: ADMIN_SESSION, viewport: { width: 1024, height: 768 } });

test("вкладки статуса заказа не обрезаны на 1024px", async ({ page }) => {
  await page.goto("/orders");
  // Счётчики статусов приходят вторым запросом (`meta.status_counts`) — без
  // ожидания вкладки успевают отрисоваться без бейджей и не переполняют ряд.
  await page.waitForLoadState("networkidle");

  const tablist = page.getByRole("tablist", { name: "Статус заказа" });
  await expect(tablist.getByRole("tab").first()).toBeVisible();
  const tabs = await tablist.getByRole("tab").all();
  expect(tabs.length).toBeGreaterThan(0);

  for (const tab of tabs) {
    await expect(tab).toBeInViewport();
  }
});
