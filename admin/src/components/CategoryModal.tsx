'use client';

import { useState } from 'react';
import api from '@/lib/api';

type Category = {
  id?: number;
  name?: { ru?: string; kk?: string };
  slug?: string;
  is_active?: boolean;
};

type CategoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  category: Category | null;
};

export default function CategoryModal({ isOpen, onClose, onSaved, category }: CategoryModalProps) {
  const [nameRu, setNameRu] = useState(category?.name?.ru || '');
  const [nameKk, setNameKk] = useState(category?.name?.kk || '');
  const [slug, setSlug] = useState(category?.slug || '');
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload = {
      name: { ru: nameRu, kk: nameKk },
      slug,
      is_active: isActive,
    };

    try {
      if (category) {
        await api.put(`/admin/categories/${category.id}`, payload);
      } else {
        await api.post('/admin/categories', payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Произошла ошибка при сохранении');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">
          {category ? 'Редактировать категорию' : 'Добавить категорию'}
        </h2>
        {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm text-zinc-900">
          <div>
            <label className="block font-medium mb-1">Название (RU) *</label>
            <input
              type="text"
              required
              className="w-full border border-zinc-300 rounded p-2 focus:outline-none focus:border-blue-500"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Название (KK)</label>
            <input
              type="text"
              className="w-full border border-zinc-300 rounded p-2 focus:outline-none focus:border-blue-500"
              value={nameKk}
              onChange={(e) => setNameKk(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Slug *</label>
            <input
              type="text"
              required
              className="w-full border border-zinc-300 rounded p-2 focus:outline-none focus:border-blue-500"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              className="mr-2"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActive" className="font-medium">Активна</label>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 rounded text-zinc-700 hover:bg-zinc-50"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
