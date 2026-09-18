import { test, expect } from "@playwright/test";

/**
 * Вход по SMS-коду после истёкшей сессии.
 *
 * Регрессия, ради которой тест написан: токен покупателя живёт в localStorage
 * бессрочно, а cookie `laravel_session`, по которой middleware пускает в
 * /account, — сутки. Шапка при этом считает покупателя вошедшим и ведёт
 * «Кабинет» прямо в /account/orders; middleware без cookie отправляет на
 * /login, и клиентский роутер Next запоминает этот редирект. После кода форма
 * звала router.push("/account/orders"), роутер проигрывал запомненный редирект
 * — и покупатель, уже вошедший, оставался на странице входа.
 */

/** Одноразовый телефон. Блок +7 700 03X XXXX не пересекается с другими тестами. */
function customerPhone(): string {
  const suffix = (Date.now() + Math.floor(Math.random() * 100_000)) % 100_000;

  return `+770003${String(suffix).padStart(5, "0")}`;
}

test("после кода покупатель попадает в кабинет, даже если cookie сессии истекла", async ({ page }) => {
  // Состояние «вчерашнего» покупателя: токен в localStorage есть, cookie нет.
  await page.addInitScript(() => {
    if (!window.localStorage.getItem("paradise-auth")) {
      window.localStorage.setItem(
        "paradise-auth",
        JSON.stringify({ state: { token: "1|expired", user: null }, version: 0 }),
      );
    }
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Кабинет" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/login");

  await page.getByLabel("Телефон").fill(customerPhone());
  await page.getByRole("button", { name: "Получить код" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Введите код" }),
    "код не запрошен — если тест гоняли подряд, это лимит 5 запросов кода в минуту; подождите минуту",
  ).toBeVisible();

  await page.getByLabel("Код из SMS").fill("1111");
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL((url) => url.pathname === "/account/orders");
});
