import { isAxiosError } from 'axios';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');

const MAX_BYTES = 10 * 1024 * 1024;

/** Фото товара, как его отдаёт `/admin/products/{id}/media`. */
export type ProductImage = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };

/** Фото, выбранное до сохранения товара или не загрузившееся после. */
export type QueuedPhoto = {
  key: string;
  file: File;
  /** object URL для превью — освобождать через URL.revokeObjectURL. */
  preview: string;
  status: 'waiting' | 'uploading' | 'failed';
  error?: string;
};

/** Те же ограничения, что на сервере: фото на 30 МБ отказывает сразу, а не после загрузки. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) {
    return `${file.name}: только JPEG, PNG или WebP`;
  }
  if (file.size > MAX_BYTES) {
    return `${file.name}: больше 10 МБ`;
  }

  return null;
}

let nextKey = 1;

export const queuePhoto = (file: File): QueuedPhoto => ({
  key: `photo-${nextKey++}`,
  file,
  preview: URL.createObjectURL(file),
  status: 'waiting',
});

/**
 * Ошибка загрузки фото. `reported` — об ошибке уже сказал перехватчик axios
 * (сеть, 5xx, 403, см. lib/api.ts): второй тост про то же не нужен.
 */
export class PhotoUploadError extends Error {
  readonly reported: boolean;

  constructor(message: string, reported: boolean) {
    super(message);
    this.reported = reported;
  }
}

/**
 * Загружает одно фото в товар. Возвращает загруженное фото. Ошибка —
 * PhotoUploadError с текстом для человека.
 */
export async function uploadPhoto(productId: number, file: File): Promise<ProductImage> {
  const body = new FormData();
  body.append('file', file);

  try {
    const res = await api.post<{ data: ProductImage }>(`/admin/products/${productId}/media`, body, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res.data.data;
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const reported = isAxiosError(error) && (status === undefined || status >= 500 || status === 403);

    throw new PhotoUploadError(serverMessage(error) ?? 'не загрузилось', reported);
  }
}

/** Тост «файл: причина», если о причине ещё не сказали. Возвращает текст для пометки у фото. */
export function reportPhotoError(file: File, error: unknown): string {
  const message = error instanceof Error ? error.message : 'не загрузилось';

  if (!(error instanceof PhotoUploadError && error.reported)) {
    toast.error(`${file.name}: ${message}`);
  }

  return message;
}
