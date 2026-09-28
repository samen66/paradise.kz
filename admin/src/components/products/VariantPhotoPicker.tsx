'use client';

import { useState } from 'react';
import { PHOTO_ACCEPT, photoProblem, reportPhotoError, uploadPhoto, type ProductImage } from './form/photos';
import { toast } from '@/stores/toastStore';

type Props = {
  productId: number;
  /** Галерея товара. */
  images: ProductImage[];
  /** id фото варианта по порядку. */
  selected: number[];
  onToggle: (id: number) => void;
  /** Фото загружено в галерею — отметить его и обновить галерею. */
  onUploaded: (image: ProductImage) => void;
  onUploadingChange: (uploading: boolean) => void;
};

/**
 * Фото варианта — отметки на фото товара. Номер на плитке — порядок у
 * варианта. «+ Загрузить» кладёт файл в галерею товара и сразу отмечает.
 */
export default function VariantPhotoPicker({ productId, images, selected, onToggle, onUploaded, onUploadingChange }: Props) {
  const [uploading, setUploading] = useState(0);

  const upload = async (files: FileList | null) => {
    const accepted = Array.from(files ?? []).filter((file) => {
      const problem = photoProblem(file);
      if (problem) {
        toast.error(problem);
      }

      return problem === null;
    });

    if (accepted.length === 0) {
      return;
    }

    setUploading((n) => n + accepted.length);
    onUploadingChange(true);

    for (const file of accepted) {
      try {
        onUploaded(await uploadPhoto(productId, file));
      } catch (error) {
        reportPhotoError(file, error);
      } finally {
        setUploading((n) => {
          const left = n - 1;
          if (left === 0) {
            onUploadingChange(false);
          }

          return left;
        });
      }
    }
  };

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {images.map((image) => {
        const position = selected.indexOf(image.id);
        const checked = position !== -1;

        return (
          <li key={image.id}>
            <button
              type="button"
              aria-pressed={checked}
              aria-label={`Фото ${image.file_name}${checked ? `, ${position + 1}-е у варианта` : ''}`}
              onClick={() => onToggle(image.id)}
              className={`relative block w-full overflow-hidden rounded-lg border-2 ${checked ? 'border-blue-600' : 'border-transparent'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.thumb_url} alt="" className={`aspect-square w-full object-cover ${checked ? '' : 'opacity-60'}`} />
              {checked && (
                <span className="absolute top-1 left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
                  {position + 1}
                </span>
              )}
            </button>
          </li>
        );
      })}
      <li>
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 p-2 text-center text-xs text-zinc-500 hover:bg-zinc-50 focus-within:border-blue-500">
          <span aria-hidden className="text-2xl leading-none">＋</span>
          <span>{uploading > 0 ? 'Загружаем…' : 'Загрузить'}</span>
          <input
            type="file"
            multiple
            accept={PHOTO_ACCEPT}
            className="sr-only"
            aria-label="Загрузить фото варианта"
            onChange={(e) => {
              void upload(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </li>
    </ul>
  );
}
