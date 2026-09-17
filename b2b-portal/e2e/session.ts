import path from "node:path";

/**
 * Куда auth.setup.ts кладёт сессию оптовика.
 *
 * Отдельным модулем, потому что Playwright запрещает тестовым файлам
 * импортировать друг друга.
 */
export const B2B_SESSION = path.join(__dirname, ".auth/b2b.json");
