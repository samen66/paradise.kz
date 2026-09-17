import fs from "node:fs";
import type { APIRequestContext } from "@playwright/test";
import { ADMIN_SESSION } from "./session";

/**
 * Best-effort API cleanup helper for `test.afterEach` hooks.
 *
 * The specs drive the UI and delete what they create through it too — this
 * is only the safety net for when a test fails *before* reaching its own
 * cleanup step. It reads the same bearer token the admin app itself keeps in
 * `localStorage` (`admin_token`), straight out of the saved storageState
 * (`ADMIN_SESSION`), so cleanup works even after the page has been left in a
 * broken state by a failed assertion.
 *
 * Same default as `admin/.env.local`'s `NEXT_PUBLIC_API_URL` — override with
 * `E2E_API_URL` if the API lives elsewhere.
 */
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000/api";

type StorageState = {
  origins?: { origin: string; localStorage?: { name: string; value: string }[] }[];
};

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync(ADMIN_SESSION, "utf8")) as StorageState;

  for (const origin of state.origins ?? []) {
    const entry = origin.localStorage?.find((item) => item.name === "admin_token");

    if (entry) {
      return entry.value;
    }
  }

  throw new Error(`Нет admin_token в ${ADMIN_SESSION} — сначала прогони e2e/auth.setup.ts.`);
}

export function adminApi(request: APIRequestContext) {
  const headers = () => ({
    Authorization: `Bearer ${adminToken()}`,
    Accept: "application/json",
  });

  return {
    /** Never throws — a failed cleanup lookup returns null and callers skip it. */
    async get<T = unknown>(path: string): Promise<T | null> {
      try {
        const res = await request.get(`${API_URL}${path}`, { headers: headers() });

        return (await res.json()) as T;
      } catch {
        return null;
      }
    },
    /** Never throws — 404s and network errors are both fine to ignore in cleanup. */
    async delete(path: string): Promise<void> {
      try {
        await request.delete(`${API_URL}${path}`, { headers: headers() });
      } catch {
        // Best-effort: cleanup must never fail the test.
      }
    },
  };
}
