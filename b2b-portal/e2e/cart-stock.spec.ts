import { test, expect, type Page } from "@playwright/test";
import { B2B_SESSION } from "./session";
import { requireInStockProduct } from "./fixtures";
import { productCard, snap, stockInCard } from "./shop";

/**
 * Корзина портала не пускает дальше остатка на складе.
 *
 * Работает на товаре «в наличии» и ничего не покупает: корзина живёт в
 * localStorage браузера, остаток в базе не меняется. Число берётся с карточки
 * каталога, а не из фикстур, — товар могли докупить руками.
 */
test.use({ storageState: B2B_SESSION });

const CART_KEY = "paradise-b2b-cart";

async function openCard(page: Page, article: string): Promise<number> {
  await page.goto(`/catalog?q=${encodeURIComponent(article)}`);
  await expect(productCard(page, article)).toContainText("В наличии:");

  return stockInCard(page, article);
}

/** Количество строки в сохранённой корзине — как будто остаток продали после того, как товар положили. */
async function setCartQuantity(page: Page, productId: number, quantity: number): Promise<void> {
  await page.evaluate(
    ({ key, productId, quantity }) => {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      saved.state.items = saved.state.items.map((item: { product: { id: number } }) =>
        item.product.id === productId ? { ...item, quantity } : item,
      );
      localStorage.setItem(key, JSON.stringify(saved));
    },
    { key: CART_KEY, productId, quantity },
  );
}

test("счётчик в каталоге: «−» убирает, «+» добавляет не больше остатка и потом выключается", async ({ page }) => {
  const product = requireInStockProduct();
  const stock = await openCard(page, product.article);
  expect(stock, "товар «в наличии» раскуплен — повторите прогон приёмки").toBeGreaterThan(0);

  const card = productCard(page, product.article);
  const counter = card.getByRole("spinbutton", { name: "Количество в корзине" });

  await test.step("первое нажатие превращает кнопку в счётчик, «−» на одной штуке убирает товар", async () => {
    await card.getByRole("button", { name: "В корзину" }).click();
    await expect(counter).toHaveValue("1");
    await snap(page, "каталог: в корзине 1 шт");

    await card.getByRole("button", { name: "Убрать из корзины" }).click();
    await expect(counter).toHaveCount(0);
    await expect(card.getByRole("button", { name: "В корзину" })).toBeVisible();
  });

  await card.getByRole("button", { name: "В корзину" }).click();

  for (let count = 1; count < stock; count++) {
    await card.getByRole("button", { name: "Добавить ещё одну" }).click();
    await expect(counter).toHaveValue(String(count + 1));
  }

  const full = card.getByRole("button", { name: `Максимум ${stock} шт.` });
  await expect(full).toBeDisabled();
  await expect(counter).toHaveValue(String(stock));
  await snap(page, `каталог: счётчик ${stock} шт, «+» выключен`);

  await page.goto("/cart");
  const line = page.getByRole("listitem").filter({ hasText: product.name });
  await expect(line.getByRole("spinbutton", { name: "Количество" })).toHaveValue(String(stock));
  await expect(line.getByRole("button", { name: `Максимум ${stock} шт.` })).toBeDisabled();
  await expect(page.getByText("Недостаточно на складе")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Оформить заказ" })).not.toHaveAttribute("aria-disabled", "true");
  await snap(page, `корзина: ${stock} шт, «+» выключен`);
});

test("корзина больше остатка: оформить нельзя, пока не уменьшить до остатка", async ({ page }) => {
  const product = requireInStockProduct();
  const stock = await openCard(page, product.article);
  expect(stock, "товар «в наличии» раскуплен — повторите прогон приёмки").toBeGreaterThan(0);

  await productCard(page, product.article).getByRole("button", { name: "В корзину" }).click();
  await setCartQuantity(page, product.id, stock + 3);

  await test.step("корзина показывает нехватку и закрывает оформление", async () => {
    await page.goto("/cart");

    const line = page.getByRole("listitem").filter({ hasText: product.name });
    await expect(line).toContainText(`Недостаточно на складе — На складе ${stock} шт.`);
    await expect(page.getByRole("alert").filter({ hasText: "Исправьте отмеченные товары" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Оформить заказ" })).toHaveAttribute("aria-disabled", "true");
    await snap(page, `корзина: ${stock + 3} шт при остатке ${stock}`);
  });

  await test.step("прямой заход на оформление: кнопка заказа выключена", async () => {
    await page.goto("/checkout");

    await expect(page.getByRole("alert").filter({ hasText: `На складе ${stock} шт.` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Оформить заказ" })).toBeDisabled();
    await snap(page, "оформление: заказ больше остатка не отправить");
  });

  await test.step(`«Оставить ${stock} шт.» чинит корзину`, async () => {
    await page.goto("/cart");
    await page.getByRole("button", { name: `Оставить ${stock} шт.` }).click();

    await expect(page.getByText("Недостаточно на складе")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Оформить заказ" })).not.toHaveAttribute("aria-disabled", "true");
    await snap(page, `корзина: уменьшено до ${stock} шт`);
  });
});

test("количество в корзине вводится с клавиатуры: лишнее урезается до остатка, пустое не применяется", async ({ page }) => {
  const product = requireInStockProduct();
  const stock = await openCard(page, product.article);
  expect(stock, "товар «в наличии» раскуплен — повторите прогон приёмки").toBeGreaterThan(0);

  await productCard(page, product.article).getByRole("button", { name: "В корзину" }).click();
  await page.goto("/cart");

  const line = page.getByRole("listitem").filter({ hasText: product.name });
  const quantity = line.getByRole("spinbutton", { name: "Количество" });
  await expect(quantity).toHaveValue("1");

  await test.step("число больше остатка набирается сразу и урезается до остатка с подсказкой", async () => {
    await quantity.fill(String(stock + 50));
    await quantity.press("Enter");

    await expect(quantity).toHaveValue(String(stock));
    await expect(line.getByRole("status")).toHaveText(`Доступно только ${stock} шт.`);
    await expect(page.getByText("Недостаточно на складе")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Оформить заказ" })).not.toHaveAttribute("aria-disabled", "true");
    await snap(page, `корзина: введено ${stock + 50}, стало ${stock}`);
  });

  await test.step("пустое поле и Escape возвращают прежнее количество", async () => {
    await quantity.fill("");
    await quantity.blur();
    await expect(quantity).toHaveValue(String(stock));

    await quantity.fill("1");
    await quantity.press("Escape");
    await expect(quantity).toHaveValue(String(stock));
  });

  await test.step("число в пределах остатка применяется как есть", async () => {
    await quantity.fill("1");
    await quantity.press("Enter");
    await expect(quantity).toHaveValue("1");

    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), CART_KEY);
    expect(saved.state.items.find((item: { product: { id: number } }) => item.product.id === product.id)?.quantity).toBe(1);
  });
});
