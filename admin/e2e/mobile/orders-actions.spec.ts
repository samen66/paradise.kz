import { test, expect } from "@playwright/test";
import { adminApi } from "../adminApi";
import { ADMIN_SESSION } from "../session";

/**
 * Действия над заказом из списка на телефоне — шторкой снизу.
 *
 * Тест только открывает и закрывает шторку, статус не меняет. Заказ — любой
 * незавершённый, найденный через API, а не фикстурный «выкуп»: его ведёт по
 * цепочке десктопный orders.spec.ts, и после первого прогона он завершён.
 * Пункты сверяются со списком всех возможных подписей, а не с переходами
 * текущего статуса — статус может сдвинуться между загрузкой и нажатием.
 */
test.use({ storageState: ADMIN_SESSION });

const ACTION_LABELS = [
  "Подтвердить заказ",
  "Передать в доставку",
  "Завершить заказ",
  "Отменить заказ",
  "Вернуть в подтверждённые",
];

type OpenOrder = { id: number; number: string | null };

test("«⋯» открывает шторку с действиями, «Закрыть» её убирает", async ({ page, request }) => {
  const api = adminApi(request);
  let order: OpenOrder | undefined;

  for (const status of ["pending", "confirmed", "in_delivery"]) {
    const body = await api.get<{ data?: OpenOrder[] }>(`/admin/orders?filter%5Bstatus%5D=${status}`);
    order = body?.data?.[0];
    if (order) {
      break;
    }
  }

  test.skip(!order, "в базе нет незавершённых заказов — оформите заказ на витрине или прогоните приёмку");
  const { id, number } = order!;

  await page.goto(`/orders?q=${encodeURIComponent(number ?? String(id))}`);

  const card = page.getByRole("listitem").filter({ hasText: new RegExp(`#${id}\\b`) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Действия" }).click();

  const sheet = page.getByRole("dialog", { name: `Заказ #${id}` });
  await expect(sheet).toBeVisible();

  const labels = (await sheet.getByRole("list").getByRole("button").allTextContents()).map((label) => label.trim());
  expect(labels.length).toBeGreaterThan(0);
  for (const label of labels) {
    expect(ACTION_LABELS).toContain(label);
  }

  await sheet.getByRole("button", { name: "Закрыть" }).click();
  await expect(sheet).toBeHidden();
});
