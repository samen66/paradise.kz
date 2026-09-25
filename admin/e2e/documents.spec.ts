import { test, expect } from "@playwright/test";
import { adminApi } from "./adminApi";
import { ADMIN_SESSION } from "./session";
import { createStore, createWriteOffDraft, uniqueStamp } from "./warehouseApi";

/** Вкладка «Документы»: фильтры живут в адресе, черновики сверху, пустое состояние с действием. */
test.use({ storageState: ADMIN_SESSION });

test("фильтры списаний — в адресе и переживают перезагрузку", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);
  const draftId = await createWriteOffDraft(request, store.id);

  try {
    await page.goto(`/warehouse/documents?kind=write_offs&status=draft&store_id=${store.id}`);
    const kinds = page.getByRole("navigation", { name: "Вид документов" });
    await expect(kinds.getByRole("link", { name: "Списания" })).toHaveAttribute("aria-current", "page");
    const statuses = page.getByRole("radiogroup", { name: "Статус" });
    await expect(statuses.getByRole("radio", { name: /Черновики/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("link", { name: `№${draftId}` })).toBeVisible();

    await page.getByLabel("Причина").selectOption({ label: "Потеря / недостача" });
    await expect(page).toHaveURL(/reason=lost/);
    await expect(page.getByText("Ничего не найдено")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Причина")).toHaveValue("lost");
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect(page).toHaveURL(/\/warehouse\/documents\?kind=write_offs$/);
  } finally {
    await adminApi(request).delete(`/admin/write-offs/${draftId}`);
  }
});

test("фильтры приёмок: склад и статус в адресе вместе", async ({ page, request }) => {
  const stamp = uniqueStamp();
  const store = await createStore(request, stamp);

  await page.goto(`/warehouse/documents?kind=receipts&store_id=${store.id}`);
  await expect(page.getByText("Ничего не найдено")).toBeVisible();
  await page.getByRole("radio", { name: "Проведённые" }).click();
  await expect(page).toHaveURL(/status=posted/);
  await expect(page).toHaveURL(new RegExp(`store_id=${store.id}`));
});
