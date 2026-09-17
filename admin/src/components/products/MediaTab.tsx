'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import ConfirmButton from '@/components/ui/ConfirmButton';
import { buttonSecondary } from '@/components/ui/styles';

type Image = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export default function MediaTab({ productId }: { productId: number }) {
  const path = `/admin/products/${productId}/media`;
  const images = useResource<Image>(path);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files) {
      return;
    }

    setUploading(true);

    for (const file of Array.from(files)) {
      // Same limits as the server; checked first so a 30 MB photo fails instantly.
      if (!ACCEPTED.includes(file.type)) {
        toast.error(`${file.name}: только JPEG, PNG или WebP`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: больше 10 МБ`);
        continue;
      }

      const body = new FormData();
      body.append('file', file);

      try {
        await api.post(path, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      } catch (error) {
        toast.error(serverMessage(error) ?? `${file.name}: не загрузилось`);
      }
    }

    setUploading(false);
    await images.reload();
  };

  const move = async (index: number, delta: -1 | 1) => {
    const ids = images.items.map((i) => i.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];

    try {
      await api.put(`${path}/order`, { ids });
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось изменить порядок');
    }

    await images.reload();
  };

  return (
    <div className="space-y-4">
      <label className={`${buttonSecondary} cursor-pointer`}>
        {uploading ? 'Загрузка…' : 'Загрузить фото'}
        <input
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="sr-only"
          disabled={uploading}
          aria-label="Загрузить фото"
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {images.loading ? (
        <p className="text-sm text-zinc-500">Загрузка…</p>
      ) : images.items.length === 0 ? (
        <p className="text-sm text-zinc-500">Фото нет. Первое фото — главное на витрине.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {images.items.map((image, index) => (
            <li key={image.id} className="overflow-hidden rounded-lg border border-zinc-200" data-testid="product-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumb_url} alt={image.file_name} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2 text-xs">
                <div className="flex gap-1">
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Раньше" className="px-2 disabled:opacity-30">←</button>
                  <button type="button" disabled={index === images.items.length - 1} onClick={() => move(index, 1)} aria-label="Позже" className="px-2 disabled:opacity-30">→</button>
                </div>
                <ConfirmButton question="Удалить фото?" onConfirm={() => images.remove(image.id)}>Удалить</ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
