'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { serverMessage } from '@/lib/errors';
import { toast } from '@/stores/toastStore';
import ConfirmButton from './ConfirmButton';
import { buttonSecondary } from './styles';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  /** POST uploads (multipart `file`, replaces the current photo), DELETE removes. */
  path: string;
  imageUrl: string | null;
  label: string;
  hint?: string;
  onChange: () => unknown;
};

export default function SingleImageUpload({ path, imageUrl, label, hint, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    // Same limits as the server; checked first so a 30 MB photo fails instantly.
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Только JPEG, PNG или WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Файл больше 10 МБ');
      return;
    }

    const body = new FormData();
    body.append('file', file);
    setUploading(true);

    try {
      await api.post(path, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Фото загружено');
      await onChange();
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Фото не загрузилось');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-700">{label}</div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={label} className="max-h-48 rounded-lg border border-zinc-200 object-cover" />
      ) : (
        <p className="text-sm text-zinc-500">Фото не загружено</p>
      )}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <div className="flex items-center gap-4">
        <label className={`${buttonSecondary} cursor-pointer`}>
          {uploading ? 'Загрузка…' : imageUrl ? 'Заменить фото' : 'Загрузить фото'}
          <input
            type="file"
            accept={ACCEPTED.join(',')}
            className="sr-only"
            disabled={uploading}
            aria-label={label}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {imageUrl && (
          <ConfirmButton
            question="Удалить фото?"
            onConfirm={async () => {
              try {
                await api.delete(path);
                await onChange();
              } catch (error) {
                toast.error(serverMessage(error) ?? 'Не удалось удалить фото');
              }
            }}
          >
            Удалить фото
          </ConfirmButton>
        )}
      </div>
    </div>
  );
}
