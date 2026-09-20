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

/** Мёртвые статусы внешней учётной системы: остались в базе, но назначать их нельзя. */
const LEGACY = ["Архив (отправлен)", "Архив (ошибка отправки)"];

/** Рабочий путь заказа. Он односторонний: откат назад API больше не примет. */
const CHAIN = ["pending", "confirmed", "in_delivery", "completed"];

test("в выпадашке только допустимые переходы, без synced и failed", async ({ page }) => {
  const order = requireOrder("buyout");

  await page.goto(`/orders/${order.id}`);
  await settled(page);

  const select = page.getByRole("combobox");

  // На завершённом/отменённом заказе селекта нет вовсе — карточка показывает
  // «Статус финальный — изменить нельзя». Это не провал, а исчерпанная фикстура.
  test.skip(
    (await select.count()) === 0,
    "заказ уже в финальном статусе — прогоните `php artisan mvp:acceptance --fresh --fixtures`",
  );

  const current = await select.inputValue();

  // Из «нового» ведут ровно два пути; сам текущий статус стоит первым, чтобы
  // селект показывал то, что есть сейчас.
  if (current === "pending") {
    await expect(select.locator("option")).toHaveText(["Новый", "Подтверждён", "Отменён"]);
  }

  // Главное, ради чего тест и писался: мёртвые статусы внешней системы
  // менеджеру не предлагают ни при каком текущем статусе.
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
  const started = CHAIN.indexOf(await select.inputValue());

  expect(
    started,
    "заказ выпал из рабочего пути (отменён?) — перезапустите прогон приёмки",
  ).toBeGreaterThanOrEqual(0);

  // Путь односторонний, поэтому повторный прогон без пересева доходит до
  // «завершён» и дальше идти некуда — это не провал, а исчерпанная фикстура.
  test.skip(
    started === CHAIN.length - 1,
    "заказ уже завершён — прогоните `php artisan mvp:acceptance --fresh --fixtures`",
  );

  for (let step = started + 1; step < CHAIN.length; step++) {
    const next = CHAIN[step];
    const save = page.getByRole("button", { name: "Сохранить статус" });

    await select.selectOption(next);
    await expect(save).toBeEnabled();

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/admin/orders/${order.id}`) &&
        response.request().method() === "PATCH",
    );
    await save.click();
    expect((await saved).status(), `перевод в «${next}» не сохранился`).toBe(200);

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
