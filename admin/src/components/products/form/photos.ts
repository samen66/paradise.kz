import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');

const MAX_BYTES = 10 * 1024 * 1024;

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

/** Загружает одно фото в товар. Ошибка — Error с текстом для человека. */
export async function uploadPhoto(productId: number, file: File): Promise<void> {
  const body = new FormData();
  body.append('file', file);

  try {
    await api.post(`/admin/products/${productId}/media`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
  } catch (error) {
    throw new Error(serverMessage(error) ?? 'не загрузилось');
  }
}
