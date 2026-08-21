'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import BrandModal from '@/components/BrandModal';

export default function BrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);

  const fetchBrands = async () => {
    try {
      const response = await api.get('/admin/brands');
      setBrands(response.data);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот бренд?')) return;
    try {
      await api.delete(`/admin/brands/${id}`);
      fetchBrands();
    } catch (error) {
      console.error('Failed to delete brand:', error);
      alert('Ошибка при удалении');
    }
  };

  const handleCreate = () => {
    setEditingBrand(null);
    setIsModalOpen(true);
  };

  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setIsModalOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Бренды</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Добавить бренд
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">Название (RU)</th>
              <th className="px-6 py-3 font-medium">Slug</th>
              <th className="px-6 py-3 font-medium">Статус</th>
              <th className="px-6 py-3 font-medium text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  Загрузка...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  Нет брендов
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">{brand.id}</td>
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {brand.name?.ru || '-'}
                  </td>
                  <td className="px-6 py-4">{brand.slug}</td>
                  <td className="px-6 py-4">
                    {brand.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Активен
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800">
                        Неактивен
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(brand)}
                      className="text-blue-600 hover:text-blue-900 mr-4 font-medium"
                    >
                      Ред.
                    </button>
                    <button
                      onClick={() => handleDelete(brand.id)}
                      className="text-red-600 hover:text-red-900 font-medium"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <BrandModal
          key={editingBrand ? editingBrand.id : 'new'}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={fetchBrands}
          brand={editingBrand}
        />
      )}
    </div>
  );
}
