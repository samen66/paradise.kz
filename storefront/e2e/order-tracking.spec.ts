import { test, expect } from "@playwright/test";
import { requireOrder } from "./fixtures";
import { snap } from "./shop";

/**
 * «Отследить заказ» для заказа, который уже прошёл весь путь.
 *
 * Свежий заказ («В обработке») отслеживается в checkout.spec.ts. Здесь —
 * гостевой заказ прогона: менеджер довёл его до «Завершён». Покупатель должен
 * увидеть статус словами, а не служебный ключ перевода.
 */
test("завершённый заказ находится по номеру и телефону, статус написан по-русски", async ({ page }) => {
  const order = requireOrder("retail");

  expect(order.status, "прогон должен довести гостевой заказ до completed").toBe("completed");
  expect(order.phone, "у гостевого заказа в фикстурах должен быть телефон").not.toBeNull();

  await page.goto("/order-tracking");
  await page.getByPlaceholder(/Номер заказа/).fill(order.number);
  await page.getByPlaceholder("Телефон, указанный в заказе").fill(order.phone ?? "");
  await page.getByRole("button", { name: "Найти заказ" }).click();

  const number = page.getByText(order.number, { exact: true });
  await expect(number).toBeVisible();

  // Статус — плашка рядом с номером заказа.
  const status = number.locator("xpath=following-sibling::span[1]");
  await snap(page, `отслеживание заказа ${order.number} (completed)`);

  await expect(status, "вместо статуса на экране ключ перевода — в messages нет account.status.completed").not.toContainText(
    "status.",
    { timeout: 5_000 },
  );
  await expect(status).toHaveText(/^[А-ЯЁа-яё ]+$/);
});
