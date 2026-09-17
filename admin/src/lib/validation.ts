import { z } from 'zod';

export const REQUIRED = 'Обязательное поле';

/** Mirrors the server's slug regex on attributes and collections. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A {ru, kk} pair where only ru is required. */
export const translatable = z.object({
  ru: z.string().min(1, REQUIRED).max(255),
  kk: z.string().max(255),
});
