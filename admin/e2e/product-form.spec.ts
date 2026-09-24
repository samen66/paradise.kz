import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";

/**
 * Карточка товара: создание и правка на одной странице.
 *
 * Каждый тест заводит свой выключенный товар через API (на витрину он не
 * попадает) и удаляет его в afterEach — общие товары прогона приёмки не
 * трогаются.
 */
test.use({ storageState: ADMIN_SESSION });

let created: number[] = [];

test.beforeEach(() => {
  created = [];
});

test.afterEach(async ({ request }) => {
  const api = adminApi(request);

  for (const id of created) {
    await api.delete(`/admin/products/${id}`);
  }
});

type Draft = { id: number; name: string; slug: string };

async function draftProduct(request: APIRequestContext, extra: Record<string, unknown> = {}): Promise<Draft> {
  const name = `E2E товар ${Date.now()}`;
  const body = await adminApi(request).create<{ data: { id: number; slug: string } }>("/admin/products", {
    name: { ru: name },
    retail_price: "1000",
    is_active: false,
    ...extra,
  });
  created.push(body.data.id);

  return { id: body.data.id, name, slug: body.data.slug };
}

/** id товара из адреса после создания через форму. */
function rememberCreated(page: Page): number {
  const id = Number(new URL(page.url()).pathname.split("/").pop());
  created.push(id);

  return id;
}

const saveButton = (page: Page) => page.getByRole("button", { name: "Сохранить", exact: true });

test("правка сохраняется, страница остаётся открытой", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
  await expect(page.getByText("Скрыт", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Открыть на сайте ↗" })).toHaveAttribute("href", new RegExp(`/product/${product.slug}$`));
  await expect(saveButton(page)).toBeDisabled();

  await page.getByLabel("Розничная", { exact: true }).fill("1480");
  await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();
  await saveButton(page).click();

  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`/products/${product.id}`);
  await expect(saveButton(page)).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("Розничная", { exact: true })).toHaveValue("1480");
});

test("панель сохранения на виду, тост её не закрывает", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  const bar = page.getByRole("region", { name: "Сохранение" });
  await expect(bar).toBeInViewport();

  await page.getByLabel("Розничная", { exact: true }).fill("1234");
  await saveButton(page).click();

  const toast = page.getByText("Сохранено", { exact: true });
  await expect(toast).toBeVisible();
  const toastBox = (await toast.boundingBox())!;
  const saveBox = (await saveButton(page).boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(saveBox.y);
});

test("наценка к закупочной считается на лету", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await page.getByRole("button", { name: /^Закупочная, минимальная цена/ }).click();
  await page.getByLabel("Закупочная цена").fill("1000");
  await page.getByLabel("Розничная", { exact: true }).fill("1480");
  await page.getByLabel("Оптовая (B2B)").fill("900");

  const line = page.getByTestId("markup");
  await expect(line).toContainText("розница +48 %");
  await expect(line).toContainText("опт -10 %");
});

test("пустое название — ошибка под полем, запрос не уходит", async ({ page, request }) => {
  const product = await draftProduct(request);
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes(`/admin/products/${product.id}`)) {
      posts.push(r.url());
    }
  });

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Название *").fill("");
  await saveButton(page).click();

  await expect(page.getByText("Обязательное поле")).toBeVisible();
  expect(posts).toEqual([]);
});

test("«Отменить» возвращает сохранённое", async ({ page, request }) => {
  const product = await draftProduct(request);

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Название *").fill("Совсем другое");
  await page.getByRole("button", { name: "Отменить" }).click();

  await expect(page.getByLabel("Название *")).toHaveValue(product.name);
  await expect(saveButton(page)).toBeDisabled();
});

test("RU и KZ: набранное не теряется, казахский перевод можно стереть", async ({ page, request }) => {
  const product = await draftProduct(request, { name: { ru: `E2E товар ${Date.now()}`, kk: "Қазақша атауы" } });
  const kz = page.getByRole("button", { name: /^KZ/ });
  const ruButton = page.getByRole("button", { name: /^RU/ }).first();

  await page.goto(`/products/${product.id}`);
  await page.getByLabel("Описание", { exact: true }).fill("Описание по-русски");
  await kz.first().click();
  await expect(page.getByLabel("Название на казахском")).toHaveValue("Қазақша атауы");
  await page.getByLabel("Название на казахском").fill("");
  await expect(kz.first()).toHaveAccessibleName(/не заполнено/);
  await ruButton.click();
  await expect(page.getByLabel("Описание", { exact: true })).toHaveValue("Описание по-русски");

  await saveButton(page).click();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();

  await page.reload();
  await kz.first().click();
  await expect(page.getByLabel("Название на казахском")).toHaveValue("");
});

test("SEO: превью адреса и предупреждение о старых ссылках", async ({ page, request }) => {
  const product = await draftProduct(request);
  const slug = `e2e-slug-${Date.now()}`;

  await page.goto(`/products/${product.id}`);
  await page.getByRole("button", { name: /^SEO — адрес и поисковики/ }).click();
  await expect(page.getByLabel("Адрес страницы")).toHaveValue(product.slug);
  await expect(page.getByText("Старые ссылки на товар перестанут работать.")).toHaveCount(0);

  await page.getByLabel("Адрес страницы").fill(slug);
  await expect(page.getByText(`/product/${slug}`)).toBeVisible();
  await expect(page.getByText("Старые ссылки на товар перестанут работать.")).toBeVisible();
  await expect(page.getByText("0 / 60").first()).toBeVisible();
});

test("несуществующий товар — «Товар не найден»", async ({ page }) => {
  await page.goto("/products/999999999");

  await expect(page.getByText("Товар не найден")).toBeVisible();
  await expect(page.getByRole("link", { name: "К списку товаров" })).toBeVisible();
});

test("новый товар: одно нажатие — один товар, после сохранения та же страница", async ({ page }) => {
  const name = `E2E новый ${Date.now()}`;
  const creates: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/admin\/products$/.test(r.url())) {
      creates.push(r.url());
    }
  });

  await page.goto("/products/create");
  await expect(page.getByRole("heading", { level: 1, name: "Новый товар" })).toBeVisible();
  await page.getByLabel("Название *").fill(name);
  await page.getByLabel("Розничная", { exact: true }).fill("2500");
  const attributes = page.getByRole("button", { name: /^Характеристики/ });
  await expect(attributes).toBeDisabled();
  await expect(attributes).toContainText("Доступно после сохранения товара");
  await saveButton(page).dblclick();

  await expect(page).toHaveURL(/\/products\/\d+$/);
  rememberCreated(page);
  await expect(page.getByText("Товар создан")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  expect(creates).toHaveLength(1);
  await expect(attributes).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Варианты/ })).toContainText("нет");
});

const PIXEL = path.join(__dirname, "assets/pixel.png");

test("новый товар: фото до сохранения загружаются после него", async ({ page }) => {
  await page.goto("/products/create");
  await page.getByLabel("Название *").fill(`E2E с фото ${Date.now()}`);
  await page.getByLabel("Загрузить фото").setInputFiles(PIXEL);
  await expect(page.getByTestId("queued-photo")).toHaveCount(1);
  await expect(page.getByText("Загрузятся после сохранения.")).toBeVisible();

  await saveButton(page).click();

  await expect(page).toHaveURL(/\/products\/\d+$/);
  rememberCreated(page);
  await expect(page.getByText("Товар создан")).toBeVisible();
  await expect(page.getByTestId("product-image")).toHaveCount(1);
  await expect(page.getByTestId("queued-photo")).toHaveCount(0);
});

test("фото, которое не загрузилось при создании, загружается повторно", async ({ page }) => {
  let failOnce = true;
  await page.route("**/admin/products/*/media", async (route) => {
    if (route.request().method() === "POST" && failOnce) {
      failOnce = false;
      await route.fulfill({ status: 422, json: { message: "Файл повреждён" } });
    } else {
      await route.continue();
    }
  });

  await page.goto("/products/create");
  await page.getByLabel("Название *").fill(`E2E повтор ${Date.now()}`);
  await page.getByLabel("Загрузить фото").setInputFiles(PIXEL);
  await saveButton(page).click();

  await expect(page).toHaveURL(/\/products\/\d+$/);
  rememberCreated(page);
  const failed = page.getByTestId("queued-photo");
  await expect(failed).toContainText("Не загрузилось");
  await expect(page.getByText("pixel.png: Файл повреждён")).toBeVisible();

  await failed.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByTestId("product-image")).toHaveCount(1);
  await expect(failed).toHaveCount(0);
});

test("файл не того типа в очередь не попадает", async ({ page }) => {
  await page.goto("/products/create");
  await page.getByLabel("Загрузить фото").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });

  await expect(page.getByText("doc.pdf: только JPEG, PNG или WebP")).toBeVisible();
  await expect(page.getByTestId("queued-photo")).toHaveCount(0);
});
