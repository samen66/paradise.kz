import { z } from 'zod';
import type { Attribute } from '@/lib/catalogTypes';
import { kk, ru, type Translatable } from '@/lib/text';
import { REQUIRED } from '@/lib/validation';

/**
 * Строки «атрибут → значение» у товара и у варианта: схема, перевод из API
 * и обратно. id атрибута — строкой, как значение поля выбора.
 */
export type AttributeRowValue = { attribute_id: string; value: { ru: string; kk: string } };

/** Значение, как его отдаёт API товара или варианта. */
export type ApiAttributeValue = { attribute_id: number; value: Translatable; attribute?: Pick<Attribute, 'id' | 'name' | 'slug'> };

const LONG = 'Не длиннее 255 символов';

export const attributeRowsSchema = z
  .array(
    z.object({
      attribute_id: z.string().min(1, 'Выберите атрибут'),
      value: z.object({ ru: z.string().trim().min(1, REQUIRED).max(255, LONG), kk: z.string().max(255, LONG) }),
    }),
  )
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();

    rows.forEach((row, index) => {
      if (row.attribute_id !== '' && seen.has(row.attribute_id)) {
        ctx.addIssue({ code: 'custom', path: [index, 'attribute_id'], message: 'Этот атрибут уже есть' });
      }
      seen.add(row.attribute_id);
    });
  });

export const emptyAttributeRow = (): AttributeRowValue => ({ attribute_id: '', value: { ru: '', kk: '' } });

export const toAttributeRows = (values: ApiAttributeValue[] | undefined): AttributeRowValue[] =>
  (values ?? []).map((v) => ({ attribute_id: String(v.attribute_id), value: { ru: ru(v.value), kk: kk(v.value) } }));

/** Тело JSON-запроса (вариант). */
export const attributeRowsPayload = (rows: AttributeRowValue[]) =>
  rows.map((row) => ({ attribute_id: Number(row.attribute_id), value: row.value }));

/**
 * Тело multipart-запроса (товар). Пустой набор уходит пустой строкой: в
 * FormData нельзя положить пустой массив, а без ключа сервер оставил бы
 * характеристики как есть. '' сервер читает как «удалить все».
 */
export function appendAttributeRows(data: FormData, rows: AttributeRowValue[]): void {
  if (rows.length === 0) {
    data.append('attribute_values', '');

    return;
  }

  rows.forEach((row, index) => {
    data.append(`attribute_values[${index}][attribute_id]`, row.attribute_id);
    data.append(`attribute_values[${index}][value][ru]`, row.value.ru);
    data.append(`attribute_values[${index}][value][kk]`, row.value.kk);
  });
}
