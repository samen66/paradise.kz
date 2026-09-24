'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import ConfirmButton from '@/components/ui/ConfirmButton';
import { buttonDanger, buttonLink } from '@/components/ui/styles';
import api from '@/lib/api';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import FormCard from './FormCard';
import { PHOTO_ACCEPT, photoProblem, queuePhoto, reportPhotoError, uploadPhoto, type QueuedPhoto } from './photos';

type Image = { id: number; file_name: string; url: string; thumb_url: string; order: number | null };

type Props = {
  productId: number | null;
  queue: QueuedPhoto[];
  onQueueChange: Dispatch<SetStateAction<QueuedPhoto[]>>;
  /** Идёт сохранение товара — новые файлы не принимаем. */
  busy: boolean;
  className?: string;
};

const MainBadge = () => (
  <span className="absolute top-1 left-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Главное</span>
);

/**
 * Фото товара. У сохранённого товара файлы загружаются сразу. У нового —
 * копятся в очереди с превью и уходят после первого сохранения (это делает
 * ProductForm); не загрузившиеся остаются здесь с кнопкой «Повторить».
 */
export default function PhotosSection({ productId, queue, onQueueChange, busy, className }: Props) {
  const path = productId ? `/admin/products/${productId}/media` : null;
  const images = useResource<Image>(path);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const saved = productId !== null ? images.items : [];

  const addFiles = async (files: FileList | null) => {
    const accepted: File[] = [];

    for (const file of Array.from(files ?? [])) {
      const problem = photoProblem(file);
      if (problem) {
        toast.error(problem);
      } else {
        accepted.push(file);
      }
    }

    if (accepted.length === 0) {
      return;
    }

    if (productId === null) {
      onQueueChange((q) => [...q, ...accepted.map(queuePhoto)]);

      return;
    }

    setUploading(true);
    for (const file of accepted) {
      try {
        await uploadPhoto(productId, file);
      } catch (error) {
        reportPhotoError(file, error);
      }
    }
    setUploading(false);
    await images.reload();
  };

  const retry = async (photo: QueuedPhoto) => {
    if (productId === null) {
      return;
    }

    onQueueChange((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'uploading', error: undefined } : p)));

    try {
      await uploadPhoto(productId, photo.file);
      URL.revokeObjectURL(photo.preview);
      onQueueChange((q) => q.filter((p) => p.key !== photo.key));
      await images.reload();
    } catch (error) {
      const message = reportPhotoError(photo.file, error);
      onQueueChange((q) => q.map((p) => (p.key === photo.key ? { ...p, status: 'failed', error: message } : p)));
    }
  };

  const removeQueued = (photo: QueuedPhoto) => {
    URL.revokeObjectURL(photo.preview);
    onQueueChange((q) => q.filter((p) => p.key !== photo.key));
  };

  const moveQueued = (index: number, delta: -1 | 1) =>
    onQueueChange((q) => {
      const next = [...q];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];

      return next;
    });

  const moveSaved = async (index: number, delta: -1 | 1) => {
    const ids = saved.map((i) => i.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];

    try {
      await api.put(`${path}/order`, { ids });
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось изменить порядок');
    }

    await images.reload();
  };

  const arrows = (index: number, count: number, move: (index: number, delta: -1 | 1) => unknown) => (
    <div className="flex">
      <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Раньше" className="min-h-11 px-2 disabled:opacity-30 md:min-h-0">←</button>
      <button type="button" disabled={index === count - 1} onClick={() => move(index, 1)} aria-label="Позже" className="min-h-11 px-2 disabled:opacity-30 md:min-h-0">→</button>
    </div>
  );

  const disabled = busy || uploading;

  return (
    <FormCard id="photos" title="Фото" aside={<span className="text-xs text-zinc-500">JPEG, PNG, WebP до 10 МБ</span>} className={className}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {saved.map((image, index) => (
          <li key={image.id} data-testid="product-image" className="relative overflow-hidden rounded-lg border border-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.thumb_url} alt={image.file_name} className="aspect-square w-full object-cover" />
            {index === 0 && <MainBadge />}
            <div className="flex items-center justify-between gap-1 p-1 text-xs">
              {arrows(index, saved.length, moveSaved)}
              <ConfirmButton question="Удалить фото?" onConfirm={() => images.remove(image.id)}>Удалить</ConfirmButton>
            </div>
          </li>
        ))}

        {queue.map((photo, index) => (
          <li key={photo.key} data-testid="queued-photo" className="relative overflow-hidden rounded-lg border border-dashed border-zinc-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt={photo.file.name} className="aspect-square w-full object-cover opacity-80" />
            {productId === null && index === 0 && <MainBadge />}
            {photo.status === 'failed' && (
              <span className="absolute inset-x-0 top-0 bg-red-600/90 px-2 py-1 text-[11px] font-medium text-white">Не загрузилось</span>
            )}
            {photo.status === 'uploading' && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-zinc-700">Загружаем…</span>
            )}
            {/* Пока идёт сохранение, очередь уже отдана в загрузку: убирать и
                переставлять поздно — фото всё равно уйдёт. */}
            <div className={`flex items-center justify-between gap-1 p-1 text-xs ${busy ? 'invisible' : ''}`}>
              {busy ? null : productId !== null && photo.status === 'failed' ? (
                <button type="button" className={buttonLink} onClick={() => void retry(photo)}>Повторить</button>
              ) : productId === null ? (
                arrows(index, queue.length, moveQueued)
              ) : (
                <span />
              )}
              {!busy && (
                <button type="button" className={buttonDanger} disabled={photo.status === 'uploading'} onClick={() => removeQueued(photo)}>
                  Убрать
                </button>
              )}
            </div>
          </li>
        ))}

        <li>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabled) {
                void addFiles(e.dataTransfer.files);
              }
            }}
            className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-2 text-center text-xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/40 ${
              dragging ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50'
            } ${disabled ? 'cursor-wait opacity-60' : ''}`}
          >
            <span aria-hidden className="text-2xl leading-none">＋</span>
            <span>{uploading ? 'Загрузка…' : 'Перетащите фото или нажмите'}</span>
            <input
              type="file"
              multiple
              accept={PHOTO_ACCEPT}
              className="sr-only"
              disabled={disabled}
              aria-label="Загрузить фото"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </li>
      </ul>

      <p className="text-xs text-zinc-500">
        {saved.length === 0 && queue.length === 0 && 'Фото нет. '}
        Первое фото — главное на витрине.
        {productId === null && queue.length > 0 && ' Загрузятся после сохранения.'}
      </p>
    </FormCard>
  );
}
