import { test, expect } from "@playwright/test";
import { requireOrder } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Карточка заказа: смена статуса.
 *
 * Прогон приёмки доказал, что API проводит заказ по рабочим статусам и
 * отвечает 422 на мёртвые synced/failed. Здесь проверяется то, чего он
 * проверить не может: что менеджеру предлагают только допустимые переходы.
 *
 * Путь односторонний — Order::ALLOWED_TRANSITIONS не пускает заказ назад из
 * «завершён», — поэтому тест идёт от текущего статуса до конца цепочки и
 * пропускается, если фикстура уже исчерпана.
 *
 * Берётся заказ на выкуп остатка: он единственный, кто остаётся новым.
 * «Отменён» не трогаем намеренно — отмена вернула бы товар на склад и
 * развалила бы проверки распроданного товара на витрине.
 */
test.use({ storageState: ADMIN_SESSION });

// Оба теста ведут один и тот же фикстурный заказ («выкуп остатка»), и второй
// его меняет — при fullyParallel они гоняются одновременно и первый тест
// иногда читает статус, который второй уже успел сдвинуть. Раз общий заказ —
// раз порядок.
test.describe.configure({ mode: "serial" });

/** Мёртвые статусы внешней учётной системы: остались в базе, но назначать их нельзя. */
const LEGACY = ["Архив (отправлен)", "Архив (ошибка отправки)"];

/** Рабочий путь заказа. Он односторонний: откат назад API больше не примет. */
const CHAIN = ["pending", "confirmed", "in_delivery", "completed"];

/** Кнопка шага вперёд для каждого статуса рабочего пути. */
const NEXT_ACTION: Record<string, string> = {
  pending: "Подтвердить заказ",
  confirmed: "Передать в доставку",
  in_delivery: "Завершить заказ",
};

test("на карточке только допустимые переходы, без synced и failed", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);
  await settled(page);

  const card = page.getByRole("region", { name: "Статус заказа" });
  const current = await card.getAttribute("data-status");

  // На завершённом/отменённом заказе кнопок нет вовсе. Это не провал, а
  // исчерпанная фикстура.
  test.skip(
    current === "completed" || current === "cancelled",
    "заказ уже в финальном статусе — прогоните `php artisan mvp:acceptance --fresh --fixtures`",
  );

  // Из «нового» ведут ровно два пути: вперёд и отмена.
  if (current === "pending") {
    await expect(card.getByRole("button")).toHaveText(["Подтвердить заказ", "Отменить заказ"]);
  }

  // Главное, ради чего тест и писался: мёртвые статусы внешней системы
  // менеджеру не предлагают ни при каком текущем статусе.
  for (const legacy of LEGACY) {
    await expect(card.getByRole("button", { name: legacy })).toHaveCount(0);
  }
});

test("менеджер проводит заказ по рабочим статусам", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: new RegExp(order.number) })).toBeVisible();
  await settled(page);

  const card = page.getByRole("region", { name: "Статус заказа" });
  const current = (await card.getAttribute("data-status")) ?? "";

  test.skip(
    current === "completed",
    "заказ уже в финальном статусе — прогоните `php artisan mvp:acceptance --fresh --fixtures`",
  );

  const started = CHAIN.indexOf(current);

  expect(
    started,
    "заказ выпал из рабочего пути (отменён?) — перезапустите прогон приёмки",
  ).toBeGreaterThanOrEqual(0);

  for (let step = started + 1; step < CHAIN.length; step++) {
    const next = CHAIN[step];
    const action = card.getByRole("button", { name: NEXT_ACTION[CHAIN[step - 1]] });

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/admin/orders/${order.id}`) &&
        response.request().method() === "PATCH",
    );
    await action.click();
    expect((await saved).status(), `перевод в «${next}» не сохранился`).toBe(200);

    await page.reload();
    await settled(page);

    await expect(card).toHaveAttribute("data-status", next);
  }

  // Последний шаг довёл заказ до «завершён»: кнопок больше нет.
  await expect(card.getByText("Заказ завершён")).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
});

/**
 * Дождаться, пока страница договорит с API.
 *
 * Карточка тянет заказ в useEffect, а в деве React монтирует компонент дважды —
 * значит и запросов два. Если нажать кнопку перехода между их ответами,
 * запоздавший второй ответ перерисует карточку старым статусом, и тест
 * прочитает не то, что сохранил.
 */
async function settled(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}
