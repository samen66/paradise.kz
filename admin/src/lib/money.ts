/**
 * Prices cross the admin API in ₸ and are stored in тиын (see
 * App\Http\Requests\Admin\Concerns\ConvertsTengeToTiyn). The factor of 100
 * lives here and nowhere else on the client.
 */
export const tiynToTenge = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '' : String(Number(value) / 100);

export const formatTenge = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? '—'
    : `${(value / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₸`;

/** zod-friendly check for a ₸ amount typed into a form: digits, up to two decimals. */
export const TENGE_PATTERN = /^\d+(\.\d{1,2})?$/;
