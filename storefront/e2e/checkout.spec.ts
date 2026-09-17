import { test, expect } from "@playwright/test";
import { requireCheckoutProduct, requireInStockProduct, requireStore } from "./fixtures";
import { apiStock, guestPhone, placeGuestOrder, price, productCard, snap } from "./shop";

/**
 * Оформление заказа на витрине — путь покупателя целиком и то, что после него
 * видно на экране.
 *
 * Здесь данные меняются по-настоящему: тесты покупают товар «для заказа»
 * (прогон принимает его на 500 шт — хватит на сотню повторов). Поэтому тесты
 * файла идут по очереди, а не параллельно: второй не должен купить товар,
 * пока первый сверяет остаток.
 */
test.describe.configure({ mode: "default" });

test.describe("Оформление заказа", () => {
  test("после покупки витрина сразу показывает уменьшенный остаток", async ({ page, request }) => {
    // Две страницы, каждая может ждать сброса кэша до 20 с, плюс холодная компиляция дев-сервера.
    test.setTimeout(120_000);

    const product = requireCheckoutProduct();
    const store = requireStore();

    // Правда — у API: тесты оформления уже могли купить часть товара.
    const before = await apiStock(request, product.slug);
    expect(before, "товар «для заказа» раскуплен — повторите прогон приёмки").toBeGreaterThan(1);

    const stockOnPage = page.getByText(/^В наличии — \d+ шт$/);
    const cardInCatalog = productCard(page, product.article);
    const catalogUrl = `/catalog?q=${encodeURIComponent(product.article)}`;

    await page.goto(`/product/${product.slug}`);
    await expect(
      stockOnPage,
      `API отдаёт остаток ${before}, а страница товара — другой. Это кэш витрины: страница кэшируется ` +
        "на 120 с, после заказа не сбрасывается, и первый заход после истечения ещё получает старую копию",
    ).toHaveText(`В наличии — ${before} шт`);

    await page.goto(catalogUrl);
    await expect(cardInCatalog).toContainText(`В наличии: ${before} шт.`);

    // Пока страницы открыты, товар покупает кто-то другой.
    const number = await placeGuestOrder(request, { productId: product.id, storeId: store.id, quantity: 1 });
    const after = before - 1;

    expect(await apiStock(request, product.slug), `API после заказа ${number}`).toBe(after);

    // Покупатель обновляет страницу. Пара секунд на очередь со сбросом кэша —
    // допустимо; кэш витрины живёт 120 с, так что таймаут их различает.
    await expect(async () => {
      await page.goto(`/product/${product.slug}`);
      await expect(stockOnPage).toHaveText(`В наличии — ${after} шт`, { timeout: 1_000 });
    }, `После заказа ${number} API отдаёт остаток ${after}, а страница товара всё ещё показывает ${before}: кэш витрины не сбросился`).toPass({ timeout: 20_000 });

    await snap(page, `страница товара после заказа ${number}`);

    await expect(async () => {
      await page.goto(catalogUrl);
      await expect(cardInCatalog).toContainText(`В наличии: ${after} шт.`, { timeout: 1_000 });
    }, `После заказа ${number} API отдаёт остаток ${after}, а каталог всё ещё показывает ${before}: кэш витрины не сбросился`).toPass({ timeout: 20_000 });

    await snap(page, `каталог после заказа ${number}`);
  });

  test("гость оформляет заказ с самовывозом и находит его в «Отследить заказ»", async ({ page }) => {
    // Пять страниц подряд, на холодном дев-сервере каждая компилируется при первом заходе.
    test.setTimeout(120_000);

    const product = requireCheckoutProduct();
    const phone = guestPhone();
    const quantity = 2;

    await test.step("карточка товара → «В корзину»", async () => {
      await page.goto(`/product/${product.slug}`);
      await page.getByRole("button", { name: "В корзину" }).click();
      await expect(page.getByRole("button", { name: "Добавлено" })).toBeVisible();
      await snap(page, "1. товар добавлен в корзину");
    });

    await test.step(`корзина: ${quantity} шт, суммы считаются`, async () => {
      await page.getByRole("link", { name: "Корзина" }).first().click();
      await expect(page).toHaveURL(/\/cart$/);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("link", { name: product.name }).last()).toBeVisible();

      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/public/cart/validate") && r.ok()),
        page.getByRole("button", { name: "+", exact: true }).click(),
      ]);

      await expect(page.getByText("В наличии", { exact: true })).toBeVisible();
      await expect(page.getByText(`${quantity} товара на сумму`)).toBeVisible();

      const summary = page.locator("div").filter({ has: page.getByRole("heading", { name: "Итого" }) }).last();
      await expect(summary).toContainText(price(product.retail_price * quantity));

      await snap(page, `2. корзина: ${quantity} шт`);
    });

    await test.step("оформление: контакты, самовывоз, оплата при получении", async () => {
      await page.getByRole("link", { name: "Оформить заказ" }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(page.getByRole("heading", { level: 1, name: "Оформление заказа" })).toBeVisible();

      await page.getByRole("textbox", { name: "Имя" }).fill("ACC Покупатель e2e");
      await page.getByRole("textbox", { name: "Телефон" }).fill(phone);
      await page.getByRole("button", { name: "Самовывоз" }).click();
      await page.getByRole("button", { name: /Наличные при получении/ }).click();

      const aside = page.locator("form aside");
      await expect(aside).toContainText(price(product.retail_price * quantity));

      const submit = page.getByRole("button", { name: "Оформить заказ" });
      await expect(submit).toBeEnabled();

      await snap(page, "3. оформление заказа");
    });

    let number = "";

    await test.step("заказ принят сервером", async () => {
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/public/checkout") && r.request().method() === "POST"),
        page.getByRole("button", { name: "Оформить заказ" }).click(),
      ]);

      expect(response.status(), await response.text()).toBe(201);
      number = ((await response.json()) as { data: { number: string } }).data.number;
      expect(number).toMatch(/^P-\d{6}$/);
    });

    await test.step("страница «Спасибо» с номером заказа", async () => {
      // Мягко: если покупателя увело не туда, заказ всё равно создан, и
      // отслеживание ниже стоит проверить — номер уже известен из ответа.
      await expect
        .soft(page, `заказ ${number} создан, но покупатель не попал на страницу «Спасибо» и номера не увидел`)
        .toHaveURL(new RegExp(`/checkout/success\\?number=${number}$`));
      await expect.soft(page.getByText(`Номер вашего заказа: ${number}`)).toBeVisible({ timeout: 5_000 });

      await snap(page, `4. после «Оформить заказ» (${number})`);
    });

    await test.step(`«Отследить заказ»: ${number} находится по номеру и телефону`, async () => {
      await page.goto("/order-tracking");
      await page.getByPlaceholder(/Номер заказа/).fill(number);
      await page.getByPlaceholder("Телефон, указанный в заказе").fill(phone);
      await page.getByRole("button", { name: "Найти заказ" }).click();

      await expect(page.getByText(number, { exact: true })).toBeVisible();
      await expect(page.getByText("В обработке", { exact: true })).toBeVisible();
      await expect(page.getByText(`${product.name} × ${quantity}`)).toBeVisible();
      await expect(page.locator("main")).toContainText(price(product.retail_price * quantity));

      await snap(page, `5. отслеживание заказа ${number}`);
    });

    await test.step("корзина после заказа пуста", async () => {
      await page.goto("/cart");
      await expect(page.getByRole("heading", { name: "Ваша корзина пуста" })).toBeVisible();
    });
  });

  test("если товар раскупили, пока покупатель оформлял, заказ не проходит и причина видна", async ({ page }) => {
    const product = requireInStockProduct();

    await page.goto(`/product/${product.slug}`);
    await page.getByRole("button", { name: "В корзину" }).click();
    await expect(page.getByRole("button", { name: "Добавлено" })).toBeVisible();

    await page.goto("/checkout");
    await page.getByRole("textbox", { name: "Имя" }).fill("ACC Опоздавший e2e");
    await page.getByRole("textbox", { name: "Телефон" }).fill(guestPhone());

    const submit = page.getByRole("button", { name: "Оформить заказ" });
    await expect(submit).toBeEnabled();

    // Пока покупатель заполнял форму, остаток разобрали. Выкупать товар
    // по-настоящему нельзя — на его семёрке стоят остальные проверки, — поэтому
    // тот же эффект получается честно: заказ уходит на сервер с количеством
    // больше остатка, и отказывает настоящая проверка склада.
    await page.route("**/public/checkout", async (route) => {
      if (route.request().method() !== "POST") {
        return route.continue();
      }

      const body = route.request().postDataJSON() as { items: { product_id: number; quantity: number }[] };
      body.items = body.items.map((item) => ({ ...item, quantity: product.stock + 1_000 }));

      await route.continue({ postData: JSON.stringify(body) });
    });

    await submit.click();

    await expect(page.getByText(`Товара «${product.name}» недостаточно на складе`)).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(submit).toBeEnabled();
    await snap(page, "отказ: товара недостаточно на складе");

    await page.unroute("**/public/checkout");

    // Остаток не тронут.
    await page.goto(`/product/${product.slug}`);
    await expect(page.getByText(`В наличии — ${product.stock} шт`)).toBeVisible();
  });
});
