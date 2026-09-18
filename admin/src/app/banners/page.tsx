'use client';

import { useState } from 'react';
import { useResource } from '@/lib/crud';
import { ru } from '@/lib/text';
import { BannerFields, bannerSchema, PLACEMENTS, toBannerForm, type Banner, type Placement } from '@/components/banners/BannerForm';
import ConfirmButton from '@/components/ui/ConfirmButton';
import CrudModal from '@/components/ui/CrudModal';
import DataTable, { type Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import SingleImageUpload from '@/components/ui/SingleImageUpload';
import { buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';

export default function BannersPage() {
  const [placement, setPlacement] = useState<Placement | ''>('');
  const banners = useResource<Banner>('/admin/banners', placement ? { placement } : undefined);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = banners.items.find((b) => b.id === editingId) ?? null;

  const columns: Column<Banner>[] = [
    {
      key: 'image',
      header: 'Фото',
      className: 'w-32',
      render: (b) =>
        b.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.image_url} alt="" className="h-12 w-24 rounded object-cover" />
        ) : (
          <span className="text-xs text-red-600">нет фото</span>
        ),
    },
    { key: 'title', header: 'Заголовок', render: (b) => ru(b.title) || '—' },
    { key: 'placement', header: 'Место', render: (b) => PLACEMENTS[b.placement] },
    { key: 'sort', header: 'Порядок', render: (b) => b.sort_order },
    { key: 'active', header: 'Статус', render: (b) => (b.is_active ? 'Показан' : 'Скрыт') },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-4">
          <button type="button" className={buttonLink} onClick={() => setEditingId(b.id)}>Изменить</button>
          <ConfirmButton onConfirm={() => banners.remove(b.id)}>Удалить</ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Баннеры"
        actions={<button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>Добавить баннер</button>}
      />
      <div className="mb-4 max-w-xs">
        <select
          aria-label="Место"
          className={inputClass}
          value={placement}
          onChange={(e) => setPlacement(e.target.value as Placement | '')}
        >
          <option value="">Все места</option>
          {Object.entries(PLACEMENTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} rows={banners.items} loading={banners.loading} emptyText="Баннеров пока нет" />

      {creating && (
        <CrudModal
          title="Новый баннер"
          schema={bannerSchema}
          defaultValues={toBannerForm(null, placement || 'b2b_home')}
          onSubmit={async (values) => {
            const banner = await banners.create(values);
            // A placement filter can exclude the new banner from the reloaded
            // list — switch to its placement so the edit dialog can find it.
            if (placement && banner.placement !== placement) {
              setPlacement(banner.placement);
            }
            // The photo needs an id: continue in the edit dialog.
            setEditingId(banner.id);
          }}
          onClose={() => setCreating(false)}
        >
          {(form) => <BannerFields form={form} />}
        </CrudModal>
      )}

      {editing && (
        <CrudModal
          title="Изменить баннер"
          schema={bannerSchema}
          defaultValues={toBannerForm(editing)}
          onSubmit={(values) => banners.update(editing.id, values)}
          onClose={() => setEditingId(null)}
        >
          {(form) => (
            <>
              <SingleImageUpload
                path={`/admin/banners/${editing.id}/image`}
                imageUrl={editing.image_url}
                label="Фото баннера"
                hint="Горизонтальное интерьерное фото, от 1920×800"
                onChange={banners.reload}
              />
              <BannerFields form={form} />
            </>
          )}
        </CrudModal>
      )}
    </div>
  );
}
