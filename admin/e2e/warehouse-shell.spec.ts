import { test, expect } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Раздел «Склад»: один вход, вкладки, прежние адреса ведут сюда же.
 *
 * Шесть пунктов меню «Запасы» свернулись в один. Старые адреса живут в
 * закладках и в ссылках из уведомлений — редирект обязан донести и
 * параметры, иначе «движения этого документа» превратятся во «все движения».
 */
test.use({ storageState: ADMIN_SESSION });

test("«Склад» открывается на остатках, вкладки ведут по разделу", async ({ page }) => {
  await page.goto("/warehouse");
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
  await expect(page.getByRole("heading", { level: 1, name: "Склад" })).toBeVisible();

  const tabs = page.getByRole("navigation", { name: "Разделы склада" });
  await expect(tabs.getByRole("link", { name: "Остатки" })).toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "Движения" }).click();
  await expect(page).toHaveURL(/\/warehouse\/movements$/);
  await expect(tabs.getByRole("link", { name: "Движения" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Остатки" })).not.toHaveAttribute("aria-current", "page");
});

test("старые адреса ведут в новый раздел с параметрами", async ({ page }) => {
  const cases: [string, RegExp][] = [
    ["/stock", /\/warehouse\/stock$/],
    ["/stock-movements?type=receipt", /\/warehouse\/movements\?type=receipt$/],
    ["/stock-movements?document=receipt:1", /\/warehouse\/movements\?document=receipt(%3A|:)1$/],
  ];

  for (const [from, to] of cases) {
    await page.goto(from);
    await expect(page, from).toHaveURL(to);
  }

  // Параметр дошёл до экрана, а не только до адреса.
  await expect(page.getByText("Показаны движения одного документа.")).toBeVisible();
});

test("«Склад» в меню ведёт в раздел", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("link", { name: "Склад", exact: true }).first().click();
  await expect(page).toHaveURL(/\/warehouse\/stock$/);
});
