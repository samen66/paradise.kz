import { test, expect } from "@playwright/test";
import { B2B_SESSION } from "./session";
import { requireB2bClient, requireCheckoutProduct, requireInStockProduct } from "./fixtures";
import { price, productCard, snap, stockInCard } from "./shop";

/**
 * Оптовый заказ целиком: быстрый заказ по артикулу → корзина → оформление →
 * «Мои заказы» → остаток в каталоге.
 *
 * Данные меняются по-настоящему: тест покупает товар «для заказа» (прогон
 * принимает его на 500 шт). Его же покупают тесты витрины, поэтому сьюты
 * витрины и портала гонять друг за другом, а не одновременно — иначе число
 * «до» и «после» здесь разъедется на чужую покупку.
 */
test.use({ storageState: B2B_SESSION });
test.describe.configure({ mode: "default" });

test("партнёр оформляет заказ через «Быстрый заказ», видит его в заказах, остаток уменьшается", async ({ page }) => {
  // Пять экранов подряд, на холодном дев-сервере каждый компилируется при первом заходе.
  test.setTimeout(120_000);

  const product = requireCheckoutProduct();
  const client = requireB2bClient();
  const quantity = 2;
  const catalogUrl = `/catalog?q=${encodeURIComponent(product.article)}`;

  let before = 0;
  let number = "";

  await test.step("остаток в каталоге до заказа", async () => {
    await page.goto(catalogUrl);
    await expect(productCard(page, product.article)).toContainText("В наличии:");
    before = await stockInCard(page, product.article);
    expect(before, "товар «для заказа» раскуплен — повторите прогон приёмки").toBeGreaterThanOrEqual(quantity);
  });

  await test.step(`быстрый заказ: «${product.article}, ${quantity}»`, async () => {
    await page.goto("/quick-order");
    await page.getByPlaceholder("Артикул, Количество").fill(`${product.article}, ${quantity}`);
    await page.getByRole("button", { name: "Добавить в корзину" }).click();

    await expect(page.getByText("Добавлен в корзину")).toBeVisible();
    await expect(page.getByText(product.name)).toBeVisible();
    await snap(page, "1. быстрый заказ");

    await page.getByRole("button", { name: "Перейти в корзину" }).click();
    await expect(page).toHaveURL(/\/cart$/);
  });

  await test.step(`корзина: ${quantity} шт по оптовой цене`, async () => {
    await expect(page.getByRole("link", { name: product.name }).last()).toBeVisible();
    await expect(page.getByText("Недостаточно на складе")).toHaveCount(0);
    await expect(page.locator("aside")).toContainText(price(product.b2b_price * quantity));
    await snap(page, `2. корзина: ${quantity} шт`);

    // Оформление первым делом сверяет корзину с API: без сверки сумма там 0 ₸,
    // а кнопка заказа неактивна. Ответ ловится заранее, чтобы при провале
    // отчёт назвал запрос, а не только пустую сумму.
    const validation = page.waitForResponse((r) => r.url().includes("/cart/validate"));

    await page.getByRole("link", { name: "Оформить заказ" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    const response = await validation;
    expect(
      response.status(),
      `оформление сверяет корзину через POST ${new URL(response.url()).pathname} и получает HTTP ${response.status()} — ` +
        "без сверки сумма 0 ₸ и заказ не оформить (корзина это прячет: при ошибке считает сумму сама)",
    ).toBe(200);
  });

  await test.step("оформление", async () => {
    await page.getByRole("textbox", { name: "Имя" }).fill("ACC Партнёр e2e");
    await page.getByRole("textbox", { name: "Телефон" }).fill(client.phone);
    await page.getByRole("button", { name: "Самовывоз" }).click();

    await expect(page.locator("form aside")).toContainText(price(product.b2b_price * quantity));

    const submit = page.getByRole("button", { name: "Оформить заказ" });
    await expect(submit).toBeEnabled();
    await snap(page, "3. оформление заказа");

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/checkout") && r.request().method() === "POST"),
      submit.click(),
    ]);

    expect(response.status(), await response.text()).toBe(201);
    number = ((await response.json()) as { data: { number: string } }).data.number;
    expect(number).toMatch(/^P-\d{6}$/);
  });

  await test.step("страница «Спасибо» с номером заказа", async () => {
    // Мягко: заказ уже создан, и «Мои заказы» ниже стоит проверить в любом случае.
    await expect
      .soft(page, `заказ ${number} создан, но партнёр не попал на страницу «Спасибо» и номера не увидел`)
      .toHaveURL(new RegExp(`/checkout/success\\?number=${number}$`));
    await expect.soft(page.getByText(`Номер вашего заказа: ${number}`)).toBeVisible({ timeout: 5_000 });

    await snap(page, `4. после «Оформить заказ» (${number})`);
  });

  await test.step(`«Мои заказы»: ${number} в обработке`, async () => {
    await page.goto("/orders");

    const row = page.getByRole("link").filter({ hasText: `Заказ ${number}` });
    await expect(row).toBeVisible();
    await expect(row).toContainText("В обработке");
    await snap(page, `5. заказы: ${number}`);
  });

  await test.step(`каталог: остаток стал ${before} − ${quantity}`, async () => {
    await page.goto(catalogUrl);
    await expect(productCard(page, product.article)).toContainText(`В наличии: ${before - quantity} шт.`);
    await snap(page, `6. каталог после заказа ${number}`);
  });
});

test("«Быстрый заказ» не кладёт в корзину больше, чем есть на складе", async ({ page }) => {
  const product = requireInStockProduct();
  const tooMany = product.stock + 1;

  await page.goto("/quick-order");
  await page.getByPlaceholder("Артикул, Количество").fill(`${product.article}, ${tooMany}`);
  await page.getByRole("button", { name: "Добавить в корзину" }).click();

  await expect(page.getByText("Нет в наличии или недостаточно остатков")).toBeVisible();
  await expect(page.getByText("Добавлен в корзину")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Перейти в корзину" })).toHaveCount(0);

  await snap(page, `быстрый заказ: ${tooMany} шт при остатке ${product.stock}`);
});
