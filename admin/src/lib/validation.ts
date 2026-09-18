import { z } from 'zod';

export const REQUIRED = 'Обязательное поле';

/** Mirrors the server's slug regex on attributes and collections. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A {ru, kk} pair where only ru is required. */
export const translatable = z.object({
  ru: z.string().min(1, REQUIRED).max(255),
  kk: z.string().max(255),
});

/** A {ru, kk} pair where both may be empty (banner captions). */
export const optionalTranslatable = z.object({
  ru: z.string().max(255),
  kk: z.string().max(255),
});

/** Longer optional {ru, kk} text (collection description). */
export const optionalTranslatableText = z.object({
  ru: z.string().max(2000),
  kk: z.string().max(2000),
});

/** Long {ru, kk} text where ru is required ("who we are"). */
export const translatableText = z.object({
  ru: z.string().min(1, REQUIRED).max(5000),
  kk: z.string().max(5000),
});
