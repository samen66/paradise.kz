import fs from "node:fs";
import path from "node:path";

/**
 * Данные прогона `php artisan mvp:acceptance --fresh --fixtures`.
 *
 * Отдельного сидера у браузерных тестов нет и не нужно: состояние базы делает
 * сам прогон приёмки — заводит товар, проводит приёмку на 10 шт, оформляет и
 * отменяет заказы, выкупает остаток до нуля. Но все его идентификаторы
 * случайные (артикул, slug, телефоны, пароли), иначе два прогона подряд
 * дрались бы за уникальные колонки. Поэтому прогон выкладывает их в JSON, а
 * тесты читают его отсюда.
 *
 * Порядок обязателен: сначала artisan, потом Playwright. См. docs/e2e-runbook.md.
 *
 * Файл одинаков в storefront/, b2b-portal/ и admin/ — приложения независимы,
 * общего пакета между ними нет. Правки вносить во все три копии.
 */
export type AcceptanceOrder = {
  id: number;
  number: string;
  status: string;
  /** Телефон, с которым заказ оформляли, — по нему заказ ищется на «Отследить заказ». У выкупа null. */
  phone: string | null;
};

export type AcceptanceProduct = {
  id: number;
  slug: string;
  article: string;
  name: string;
  /** Розничная и оптовая цены в тенге. */
  retail_price: number;
  b2b_price: number;
  /** Остаток на момент конца прогона. */
  stock: number;
  stock_at_store: number | null;
};

export type AcceptanceFixtures = {
  version: number;
  generated_at: string;
  run_token: string;
  marker: string;
  fresh: boolean;
  /** false, если прогон был красным: состояние базы тогда недостоверно. */
  run_passed: boolean;
  store: { id: number; name: string } | null;
  admin: { email: string; password: string } | null;
  b2b_client: {
    id: number;
    phone: string;
    password: string;
    email: string;
    company_name: string | null;
    is_approved: boolean;
  } | null;
  /** Товар прогона. К концу выкуплен до нуля (сценарий 5) — образец распроданного. */
  product: AcceptanceProduct | null;
  /** Принят на 7 шт. Тесты его только разглядывают, поэтому остаток на экране — ровно stock. */
  in_stock_product: AcceptanceProduct | null;
  /** Принят на 500 шт. Его покупают тесты оформления — текущий остаток меньше stock. */
  checkout_product: AcceptanceProduct | null;
  /**
   * Заказы прогона по ролям: retail — гостевой (завершён), b2b — оптовый
   * (отменён), account — из кабинета (отменён), buyout — выкуп остатка
   * (единственный, кто остаётся новым).
   */
  orders: Partial<Record<"retail" | "b2b" | "account" | "buyout", AcceptanceOrder>>;
};

const HOW_TO_RUN = "php artisan mvp:acceptance --fresh --fixtures";

/** Формат, под который написаны тесты. Старее — значит, фикстуры от прошлой версии прогона. */
const FIXTURES_VERSION = 2;

function fixturesPath(): string {
  return (
    process.env.ACCEPTANCE_FIXTURES ??
    path.resolve(__dirname, "../../storage/app/private/acceptance-fixtures.json")
  );
}

let cached: AcceptanceFixtures | null = null;
let warnedAboutRedRun = false;

/** Читает фикстуры прогона; падает с инструкцией, если прогона не было. */
export function loadFixtures(): AcceptanceFixtures {
  if (cached) {
    return cached;
  }

  const file = fixturesPath();

  if (!fs.existsSync(file)) {
    throw new Error(
      `Нет фикстур приёмки: ${file}\n` +
        "Браузерные тесты идут поверх состояния, которое оставляет прогон приёмки. Сначала:\n" +
        `  ${HOW_TO_RUN}`,
    );
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as AcceptanceFixtures;

  if ((parsed.version ?? 0) < FIXTURES_VERSION) {
    throw new Error(
      `Фикстуры в ${file} старого формата (version ${parsed.version}, нужна ${FIXTURES_VERSION}): ` +
        `в них нет товаров в наличии для проверок остатка и оформления. Повторите: ${HOW_TO_RUN}`,
    );
  }

  if (!parsed.run_passed && !warnedAboutRedRun) {
    warnedAboutRedRun = true;
    console.warn(
      `[acceptance] Прогон в ${file} был красным — часть данных может отсутствовать.\n` +
        `Сначала почините прогон (${HOW_TO_RUN}), иначе падения тестов ниже ничего не значат.`,
    );
  }

  cached = parsed;

  return parsed;
}

function missing(what: string): Error {
  return new Error(`В фикстурах нет: ${what}. Прогон не дошёл до этого шага — повторите: ${HOW_TO_RUN}`);
}

/** Товар прогона: заведён, принят на склад на 10 шт, выкуплен до нуля. */
export function requireProduct(): AcceptanceProduct {
  const product = loadFixtures().product;

  if (!product) {
    throw missing("товар прогона");
  }

  return product;
}

/** Товар в наличии, 7 шт. Никто из тестов его не покупает. */
export function requireInStockProduct(): AcceptanceProduct {
  const product = loadFixtures().in_stock_product;

  if (!product) {
    throw missing("товар «в наличии»");
  }

  return product;
}

/** Товар для оформления заказа, 500 шт на старте. Тесты оформления его покупают. */
export function requireCheckoutProduct(): AcceptanceProduct {
  const product = loadFixtures().checkout_product;

  if (!product) {
    throw missing("товар «для заказа»");
  }

  return product;
}

/** Служебный админ прогона: роль admin, пароль известен только из фикстур. */
export function requireAdmin(): NonNullable<AcceptanceFixtures["admin"]> {
  const admin = loadFixtures().admin;

  if (!admin) {
    throw missing("админ прогона");
  }

  return admin;
}

/** Одобренный оптовик прогона: заходит в портал по телефону и паролю. */
export function requireB2bClient(): NonNullable<AcceptanceFixtures["b2b_client"]> {
  const client = loadFixtures().b2b_client;

  if (!client) {
    throw missing("B2B-клиент прогона");
  }

  if (!client.is_approved) {
    throw new Error(`B2B-клиент прогона не одобрен — в портал он не войдёт. Повторите: ${HOW_TO_RUN}`);
  }

  return client;
}

/** Заказ прогона по роли. */
export function requireOrder(role: keyof AcceptanceFixtures["orders"]): AcceptanceOrder {
  const order = loadFixtures().orders[role];

  if (!order) {
    throw missing(`заказ «${role}»`);
  }

  return order;
}

/** Склад прогона. */
export function requireStore(): NonNullable<AcceptanceFixtures["store"]> {
  const store = loadFixtures().store;

  if (!store) {
    throw missing("склад прогона");
  }

  return store;
}
