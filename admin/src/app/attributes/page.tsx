'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AttributeFormSheet from '@/components/catalog/AttributeFormSheet';
import { matchesAttribute, parseAttributeFilter, usage, usageText } from '@/components/catalog/attributeFilters';
import ActionSheet from '@/components/ui/ActionSheet';
import ConfirmButton from '@/components/ui/ConfirmButton';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import FilterChips from '@/components/ui/FilterChips';
import PageHeader from '@/components/ui/PageHeader';
import Switch from '@/components/ui/Switch';
import { buttonDanger, buttonLink, buttonPrimary, inputClass } from '@/components/ui/styles';
import api from '@/lib/api';
import type { Attribute } from '@/lib/catalogTypes';
import { useResource } from '@/lib/crud';
import { serverMessage } from '@/lib/errors';
import { kk, ru } from '@/lib/text';
import { useIsDesktop } from '@/lib/useIsDesktop';
import { toast } from '@/stores/toastStore';

/** Поиск и чип живут в адресе: F5 и «назад» открывают тот же список. */
function AttributesView() {
  const params = useSearchParams();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const attributes = useResource<Attribute>('/admin/attributes');
  const [editing, setEditing] = useState<Attribute | null | undefined>(undefined);
  const [menuFor, setMenuFor] = useState<Attribute | null>(null);
  // Переключатель «В фильтрах» меняется сразу; при ошибке значение возвращается.
  const [pendingFilterable, setPendingFilterable] = useState<Record<number, boolean>>({});

  const filter = parseAttributeFilter(params.get('filter'));
  const search = params.get('q') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(`/attributes?${next.toString()}`, { scroll: false });
  };

  const rows = attributes.items.filter((a) => matchesAttribute(a, filter, search));
  const count = (f: Parameters<typeof matchesAttribute>[1]) => attributes.items.filter((a) => matchesAttribute(a, f, '')).length;

  const toggleFilterable = async (a: Attribute, next: boolean) => {
    setPendingFilterable((p) => ({ ...p, [a.id]: next }));

    try {
      await api.put(`/admin/attributes/${a.id}`, { name: { ru: ru(a.name), kk: kk(a.name) }, slug: a.slug, is_filterable: next });
      await attributes.reload();
      toast.success(next ? 'Показывается в фильтрах витрины' : 'Убран из фильтров витрины');
    } catch (error) {
      toast.error(serverMessage(error) ?? 'Не удалось сохранить');
    } finally {
      setPendingFilterable((pending) => {
        const next = { ...pending };
        delete next[a.id];

        return next;
      });
    }
  };

  const deleteHint = (a: Attribute) => (usage(a) > 0 ? `Используется ${usageText(a)} — сначала удалите значения` : undefined);

  const columns: Column<Attribute>[] = [
    {
      key: 'name',
      header: 'Название',
      mobile: 'title',
      render: (a) => (
        <div>
          <span className="font-medium text-zinc-900">{ru(a.name)}</span>
          {kk(a.name) ? (
            <span className="block text-xs text-zinc-500">{kk(a.name)}</span>
          ) : (
            <span className="block text-xs text-amber-700">нет перевода на казахский</span>
          )}
        </div>
      ),
    },
    { key: 'slug', header: 'Slug', mobile: 'meta', render: (a) => <span className="text-zinc-500">{a.slug}</span> },
    { key: 'usage', header: 'Используется', render: (a) => usageText(a) },
    {
      key: 'filterable',
      header: 'В фильтрах',
      render: (a) => (
        <Switch checked={pendingFilterable[a.id] ?? a.is_filterable} onChange={(next) => void toggleFilterable(a, next)} label="В фильтрах" />
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      mobile: 'actions',
      render: (a) =>
        isDesktop ? (
          <div className="flex justify-end gap-4">
            <button type="button" className={buttonLink} onClick={() => setEditing(a)}>Изменить</button>
            {usage(a) > 0 ? (
              <button type="button" disabled className={buttonDanger} title={deleteHint(a)}>Удалить</button>
            ) : (
              <ConfirmButton onConfirm={() => attributes.remove(a.id)}>Удалить</ConfirmButton>
            )}
          </div>
        ) : (
          <button type="button" aria-label={`Действия: ${ru(a.name)}`} className={buttonLink} onClick={() => setMenuFor(a)}>⋯ Действия</button>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Атрибуты"
        actions={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить атрибут</button>}
      />
      <input
        type="search"
        aria-label="Поиск атрибута"
        placeholder="Название или slug"
        className={`${inputClass} md:max-w-sm`}
        defaultValue={search}
        onChange={(e) => setParam('q', e.target.value)}
      />
      <FilterChips
        label="Показать"
        value={filter}
        onChange={(value) => setParam('filter', value)}
        options={[
          { value: '', label: 'Все', count: attributes.loading ? null : attributes.items.length },
          { value: 'filterable', label: 'В фильтрах витрины', count: attributes.loading ? null : count('filterable') },
          { value: 'untranslated', label: 'Без перевода', count: attributes.loading ? null : count('untranslated') },
          { value: 'unused', label: 'Не используются', count: attributes.loading ? null : count('unused') },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        loading={attributes.loading}
        rowKey={(a) => a.id}
        empty={
          attributes.items.length === 0 ? (
            <EmptyState
              title="Атрибутов пока нет"
              hint="Создайте первый или добавьте прямо в карточке товара"
              action={<button type="button" className={buttonPrimary} onClick={() => setEditing(null)}>Добавить атрибут</button>}
            />
          ) : (
            <EmptyState title="Ничего не найдено" hint="Измените поиск или фильтр" />
          )
        }
      />

      {editing !== undefined && (
        <AttributeFormSheet attribute={editing} onSaved={() => void attributes.reload()} onClose={() => setEditing(undefined)} />
      )}
      {menuFor && (
        <ActionSheet
          title={ru(menuFor.name)}
          onClose={() => setMenuFor(null)}
          actions={[
            { key: 'edit', label: 'Изменить', onSelect: () => setEditing(menuFor) },
            {
              key: 'delete',
              label: 'Удалить',
              destructive: true,
              disabled: usage(menuFor) > 0,
              hint: deleteHint(menuFor),
              onSelect: () => {
                if (window.confirm('Удалить? Это действие необратимо.')) {
                  void attributes.remove(menuFor.id);
                }
              },
            },
          ]}
        />
      )}
    </div>
  );
}

export default function AttributesPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={null}>
      <AttributesView />
    </Suspense>
  );
}
