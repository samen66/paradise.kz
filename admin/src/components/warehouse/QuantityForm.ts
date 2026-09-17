import { z } from 'zod';
import { QUANTITY_PATTERN } from '@/lib/warehouse';

const MESSAGE = 'Количество больше нуля, до 3 знаков после точки';

export const quantityField = z
  .string()
  .regex(QUANTITY_PATTERN, MESSAGE)
  .refine((value) => Number(value) > 0, MESSAGE);
