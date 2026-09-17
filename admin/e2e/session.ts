import path from "node:path";

/**
 * Куда auth.setup.ts кладёт сессию админа.
 *
 * Отдельным модулем, потому что Playwright запрещает тестовым файлам
 * импортировать друг друга.
 */
export const ADMIN_SESSION = path.join(__dirname, ".auth/admin.json");
