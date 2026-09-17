import { test, expect, type Page } from "@playwright/test";
import { requireInStockProduct } from "./fixtures";
import { productCard, snap } from "./shop";

/**
 * Избранное глазами покупателя: вход по SMS-коду, сердечко на странице товара,
 * список в кабинете и удаление обратно.
 *
 * Регрессия, ради которой тест написан: PUT /account/favorites/{id} отвечает
 * 201 без тела, а клиент парсил пустой ответ как JSON, падал и откатывал
 * сердечко. На сервере товар при этом добавлялся, на экране — нет, и второй
 * щелчок снова слал PUT вместо DELETE. Поэтому тест проверяет не только
 * сердечко, но и то, каким методом ушёл следующий щелчок.
 *
 * Берётся товар «в наличии» — никто его не покупает, и он всегда виден в
 * публичном каталоге.
 */

/**
 * Одноразовый телефон покупателя. Блок +7 700 02X XXXX — рядом с блоками
 * прогона приёмки (00X) и гостевого чекаута (01X), но не пересекается с ними.
 * Свежий номер — свежая учётка с пустым избранным, и лимит «один код в
 * минуту на номер» не мешает повторному запуску.
 */
function customerPhone(): string {
  const suffix = (Date.now() + Math.floor(Math.random() * 100_000)) % 100_000;

  return `+770002${String(suffix).padStart(5, "0")}`;
}

/** Вход через форму витрины. В local/testing API всегда шлёт код 1111. */
async function loginByOtp(page: Page, next: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);

  await page.getByLabel("Телефон").fill(customerPhone());
  await page.getByRole("button", { name: "Получить код" }).click();

  // Запрос кода ограничен пятью в минуту с одного IP (throttle:5,1): форма тогда
  // пишет «Ошибка. Попробуйте ещё раз.» и на шаг кода не переходит.
  await expect(
    page.getByRole("heading", { level: 1, name: "Введите код" }),
    "код не запрошен — если тест гоняли подряд, это лимит 5 запросов кода в минуту; подождите минуту",
  ).toBeVisible();

  await page.getByLabel("Код из SMS").fill("1111");
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL((url) => url.pathname.endsWith(next));
}

/**
 * Сердечко на странице товара. Их там два: в блоке покупки и в нижней панели
 * телефона (lg:hidden) — на десктопе видно только первое.
 */
function heart(page: Page) {
  return page.getByRole("button", { name: "В избранное" }).filter({ visible: true });
}

/**
 * Щелчок по сердечку. Возвращает метод и статус ушедшего запроса — метод и
 * есть проверка: он показывает, что компонент считал состоянием до щелчка.
 */
async function clickHeart(page: Page, productId: number): Promise<{ method: string; status: number | undefined }> {
  const request = page.waitForRequest(
    (r) => r.url().endsWith(`/account/favorites/${productId}`) && r.method() !== "OPTIONS",
  );
  await heart(page).click();

  const sent = await request;
  const response = await sent.response();
  // Тело целиком дошло до браузера. finished() не годится — тело 204 страница
  // не читает, и он не дожидается; а body() на пустом теле бросает «No data
  // found», что для нас то же самое: дожидаться нечего.
  await response?.body().catch(() => undefined);

  // Компоненту ещё нужно разобрать ответ и перерисоваться — без этого проверка
  // сердечка успевает раньше отката и проходит на сломанном клиенте.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

  return { method: sent.method(), status: response?.status() };
}

test("товар добавляется в избранное, виден в кабинете и удаляется обратно", async ({ page }) => {
  const product = requireInStockProduct();
  const productPath = `/product/${product.slug}`;

  await loginByOtp(page, productPath);
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();

  // Сердечко сверяется со списком избранного после гидрации — ждём, пока тот приедет.
  await page.waitForLoadState("networkidle");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");

  // --- Добавление ---
  expect(await clickHeart(page, product.id)).toEqual({ method: "PUT", status: 201 });
  await expect(heart(page), "сердечко откатилось после ответа API").toHaveAttribute("aria-pressed", "true");
  await snap(page, "товар в избранном");

  // Второй щелчок обязан убирать. Если сердечко откатилось, уйдёт снова PUT.
  expect(await clickHeart(page, product.id), "второй щелчок по сердечку должен удалять из избранного").toEqual({
    method: "DELETE",
    status: 204,
  });
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");

  expect(await clickHeart(page, product.id)).toEqual({ method: "PUT", status: 201 });
  await expect(heart(page)).toHaveAttribute("aria-pressed", "true");

  // После перезагрузки состояние берётся с сервера, а не из памяти компонента.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(heart(page), "после перезагрузки товар не в избранном").toHaveAttribute("aria-pressed", "true");

  // --- Кабинет ---
  await page.goto("/account/favorites");
  await expect(page.getByRole("heading", { level: 1, name: "Избранное" })).toBeVisible();
  await expect(productCard(page, product.name)).toHaveCount(1);
  await snap(page, "кабинет: избранное с товаром");

  // --- Удаление ---
  await page.goto(productPath);
  await page.waitForLoadState("networkidle");
  await expect(heart(page)).toHaveAttribute("aria-pressed", "true");

  expect(await clickHeart(page, product.id)).toEqual({ method: "DELETE", status: 204 });
  await expect(heart(page)).toHaveAttribute("aria-pressed", "false");

  await page.goto("/account/favorites");
  await expect(page.getByText("В избранном пока пусто")).toBeVisible();
  await snap(page, "кабинет: избранное пусто");
});
