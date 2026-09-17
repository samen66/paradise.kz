import { test, expect } from "@playwright/test";
import { requireOrder } from "./fixtures";
import { ADMIN_SESSION } from "./session";

/**
 * Карточка заказа: смена статуса.
 *
 * Прогон приёмки доказал, что API проводит заказ по пяти рабочим статусам и
 * отвечает 422 на мёртвые synced/failed (шаги 13 и 14). Здесь проверяется то,
 * чего он проверить не может: что мёртвых статусов нет в самом выпадающем
 * списке — то есть менеджеру их даже не предлагают.
 *
 * Берётся заказ на выкуп остатка: он единственный, кто остаётся новым. «Отменён»
 * не трогаем намеренно — отмена вернула бы товар на склад и развалила бы
 * проверки распроданного товара на витрине.
 */
test.use({ storageState: ADMIN_SESSION });

/** Статусы, которые менеджер вправе назначить (Order::CLIENT_STATUSES). */
const ASSIGNABLE = ["Новый", "Подтверждён", "В доставке", "Завершён", "Отменён"];

/** Мёртвые статусы внешней учётной системы: остались в базе, но назначать их нельзя. */
const LEGACY = ["Архив (отправлен)", "Архив (ошибка отправки)"];

/** Рабочий путь заказа, по кругу. Отмены здесь нет: она вернула бы остаток. */
const CHAIN = ["pending", "confirmed", "in_delivery", "completed"];

test("в списке статусов только рабочие пять, без synced и failed", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);

  const select = page.getByRole("combobox");
  await expect(select.locator("option")).toHaveText(ASSIGNABLE);

  for (const legacy of [...LEGACY, "synced", "failed"]) {
    await expect(select.locator("option").filter({ hasText: legacy })).toHaveCount(0);
  }
});

test("менеджер проводит заказ по рабочим статусам", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByRole("heading", { name: new RegExp(order.number) })).toBeVisible();
  await settled(page);

  const select = page.getByRole("combobox");

  // Стартуем с того статуса, в котором заказ сейчас, а не с того, в котором он
  // был на момент прогона: тест должен переживать собственный повторный запуск.
  const started = CHAIN.indexOf(await select.inputValue());
  expect(
    started,
    "заказ выпал из рабочего пути (отменён?) — перезапустите прогон приёмки",
  ).toBeGreaterThanOrEqual(0);

  for (let step = 1; step <= 3; step++) {
    const next = CHAIN[(started + step) % CHAIN.length];
    const save = page.getByRole("button", { name: "Сохранить статус" });

    await select.selectOption(next);
    await expect(save).toBeEnabled();

    // Ждём сам запрос, а не всплывашку «Статус обновлён»: она живёт три
    // секунды и ловится через раз, а ответ API — факт.
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/admin/orders/${order.id}`) &&
        response.request().method() === "PATCH",
    );
    await save.click();
    expect((await saved).status(), `перевод в «${next}» не сохранился`).toBe(200);

    // Перезагрузка — чтобы читать статус из API, а не из состояния формы:
    // селект инициализируется тем, что вернул сервер.
    await page.reload();
    await settled(page);
    await expect(select).toHaveValue(next);
  }
});

/**
 * Дождаться, пока страница договорит с API.
 *
 * Карточка тянет заказ в useEffect, а в деве React монтирует компонент дважды —
 * значит и запросов два. Если выбрать статус между их ответами, второй ответ
 * перезапишет выбор обратно на серверный, кнопка сохранения снова станет
 * неактивной, и тест повиснет на запросе, которого не будет.
 */
async function settled(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}
