'use client';

import { useState } from 'react';
import { useResource } from '@/lib/crud';
import {
  formatDateTime,
  localInputToIso,
  toLocalInput,
  WRITE_OFF_REASONS,
  type DraftKind,
  type GoodsReceipt,
  type Supplier,
  type WriteOff,
} from '@/lib/warehouse';
import Field from '@/components/ui/Field';
import { cardClass, inputClass } from '@/components/ui/styles';
import StoreSelect from '../StoreSelect';

type Props = {
  kind: DraftKind;
  header: GoodsReceipt | WriteOff;
  /** Ошибки автосохранения, ключи `header:<поле>`. */
  errors: Record<string, string>;
  onSave: (patch: Record<string, string | null>) => void;
};

type Values = Record<string, string>;

const valuesOf = (kind: DraftKind, header: GoodsReceipt | WriteOff): Values => {
  if (kind === 'receipt') {
    const receipt = header as GoodsReceipt;
    return {
      store_id: String(receipt.store_id),
      supplier_id: receipt.supplier_id ? String(receipt.supplier_id) : '',
      received_at: toLocalInput(receipt.received_at),
      number: receipt.number ?? '',
      note: receipt.note ?? '',
    };
  }
  const writeOff = header as WriteOff;
  return { store_id: String(writeOff.store_id), reason: writeOff.reason, note: writeOff.note ?? '' };
};

/**
 * Шапка документа на странице. Свёрнута в строку «Склад · Поставщик · Дата
 * ✎ Изменить»; раскрыта — поля в 4 колонки на ПК, в одну на телефоне.
 * Выбор сохраняется сразу, текст и дата — при уходе с поля. Поле с ошибкой
 * держит шапку раскрытой.
 */
export default function DocumentFields({ kind, header, errors, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Values>(() => valuesOf(kind, header));
  const suppliers = useResource<Supplier>(kind === 'receipt' ? '/admin/suppliers' : null);
  const errorOf = (field: string): string | undefined => errors[`header:${field}`];
  const hasError = Object.keys(errors).some((key) => key.startsWith('header:'));
  const open = expanded || hasError;

  const set = (field: string, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const choose = (field: string, value: string) => {
    set(field, value);
    onSave({ [field]: value === '' ? null : value });
  };
  const commit = (field: string, value: string | null) => {
    const saved = valuesOf(kind, header)[field];
    if ((values[field] ?? '') !== saved) {
      onSave({ [field]: value });
    }
  };

  const summary =
    kind === 'receipt'
      ? [header.store.name, (header as GoodsReceipt).supplier?.name ?? 'Без поставщика', formatDateTime((header as GoodsReceipt).received_at)]
      : [header.store.name, WRITE_OFF_REASONS[(header as WriteOff).reason] ?? (header as WriteOff).reason];

  return (
    <section data-testid="document-fields" className={`${cardClass} p-4`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm text-zinc-700"
      >
        <span className="min-w-0 truncate">{summary.join(' · ')}</span>
        <span className="shrink-0 font-medium text-blue-600">✎ Изменить</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Склад" htmlFor="doc-store" error={errorOf('store_id')}>
            <StoreSelect id="doc-store" value={values.store_id} onChange={(e) => choose('store_id', e.target.value)} />
          </Field>

          {kind === 'receipt' ? (
            <>
              <Field label="Поставщик" htmlFor="doc-supplier" error={errorOf('supplier_id')}>
                <select id="doc-supplier" className={inputClass} value={values.supplier_id} onChange={(e) => choose('supplier_id', e.target.value)}>
                  <option value="">Без поставщика</option>
                  {suppliers.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Дата приёмки" htmlFor="doc-date" error={errorOf('received_at')}>
                <input
                  id="doc-date"
                  type="datetime-local"
                  className={inputClass}
                  value={values.received_at}
                  onChange={(e) => set('received_at', e.target.value)}
                  onBlur={(e) => commit('received_at', localInputToIso(e.target.value))}
                />
              </Field>
              <Field label="Номер накладной" htmlFor="doc-number" error={errorOf('number')}>
                <input
                  id="doc-number"
                  className={inputClass}
                  value={values.number}
                  onChange={(e) => set('number', e.target.value)}
                  onBlur={(e) => commit('number', e.target.value.trim() === '' ? null : e.target.value.trim())}
                />
              </Field>
            </>
          ) : (
            <Field label="Причина" htmlFor="doc-reason" error={errorOf('reason')}>
              <select id="doc-reason" className={inputClass} value={values.reason} onChange={(e) => choose('reason', e.target.value)}>
                {Object.entries(WRITE_OFF_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="md:col-span-4">
            <Field label="Комментарий" htmlFor="doc-note" error={errorOf('note')}>
              <textarea
                id="doc-note"
                rows={2}
                className={inputClass}
                value={values.note}
                onChange={(e) => set('note', e.target.value)}
                onBlur={(e) => commit('note', e.target.value.trim() === '' ? null : e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}
    </section>
  );
}
