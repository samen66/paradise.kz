import { z } from 'zod';
import { REQUIRED, SLUG_PATTERN } from '@/lib/validation';

export type ShowroomDay = { open: string; close: string } | null;

type Pair = { ru: string; kk: string };

/** Шоурум, как его отдаёт /admin/showrooms. */
export type Showroom = {
  id: number;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  is_active: boolean;
  show_on_site: boolean;
  landmark: Pair;
  parking: Pair;
  description: Pair;
  phone: string | null;
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  weekly_hours: ShowroomDay[];
  services: string[];
  area: string | null;
  floors: string | null;
  is_flagship: boolean;
  sort_order: number;
  cover_url: string | null;
  public_url: string | null;
  products_in_stock?: number;
};

export const SHOWROOM_SERVICES = [
  { key: 'pickup', label: 'Самовывоз' },
  { key: 'consult', label: 'Консультация в зале' },
  { key: 'card', label: 'Оплата картой' },
  { key: 'kids', label: 'Детская зона' },
  { key: 'cafe', label: 'Кофе-зона' },
  { key: 'assembly', label: 'Заказ сборки' },
];

export const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export type ShowroomStatus = 'published' | 'draft' | 'inactive';

/** Как на витрине: выключенный склад не виден, без адреса страницы — черновик. */
export const showroomStatus = (s: Pick<Showroom, 'is_active' | 'show_on_site' | 'slug'>): ShowroomStatus =>
  !s.is_active ? 'inactive' : s.show_on_site && s.slug ? 'published' : 'draft';

export const STATUS_CHIP: Record<ShowroomStatus, { label: string; className: string }> = {
  published: { label: 'На сайте', className: 'bg-green-100 text-green-800' },
  draft: { label: 'Черновик', className: 'bg-zinc-200 text-zinc-700' },
  inactive: { label: 'Склад выключен', className: 'bg-amber-100 text-amber-800' },
};

/**
 * Координаты из ссылки 2ГИС. 2ГИС пишет «долгота,широта»: `?m=76.93,43.22/17`
 * или `…/geo/…/76.93,43.22`. Нет пары чисел в допустимых пределах — null.
 */
export function coordsFrom2gis(link: string): { lat: number; lng: number } | null {
  let text = link.trim();

  try {
    text = decodeURIComponent(text);
  } catch {
    // Битая %-последовательность — ищем в исходной строке.
  }

  const match = text.match(/[?&]m=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ?? text.match(/\/(-?\d+\.\d+),(-?\d+\.\d+)(?=[/?#]|$)/);

  if (!match) {
    return null;
  }

  const lng = Number(match[1]);
  const lat = Number(match[2]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

export const twoGisUrl = (lat: string, lng: string): string => `https://2gis.kz/?m=${lng}%2C${lat}%2F17`;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const pair = (max: number) => z.object({ ru: z.string().max(max), kk: z.string().max(max) });

const coordinate = (limit: number) =>
  z.string().refine((v) => v === '' || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit), `Число от −${limit} до ${limit}`);

export const showroomSchema = z
  .object({
    name: z.string().min(1, REQUIRED).max(255),
    slug: z.string().max(100).refine((v) => v === '' || SLUG_PATTERN.test(v), 'Только строчная латиница, цифры и дефис'),
    city: z.string().max(100),
    address: z.string().max(255),
    area: z.string().max(50),
    floors: z.string().max(50),
    sort_order: z.string().regex(/^\d*$/, 'Целое число от 0'),
    is_flagship: z.boolean(),
    show_on_site: z.boolean(),
    landmark: pair(255),
    parking: pair(255),
    description: pair(5000),
    phone: z.string().max(32),
    whatsapp: z.string().refine((v) => v === '' || /^7\d{10}$/.test(v), 'Номер с 7, 11 цифр, без плюса и пробелов'),
    lat: coordinate(90),
    lng: coordinate(180),
    weekly_hours: z.array(z.object({ enabled: z.boolean(), open: z.string(), close: z.string() })).length(7),
    services: z.array(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.show_on_site && v.slug === '') {
      ctx.addIssue({ code: 'custom', path: ['show_on_site'], message: 'Сначала заполните адрес страницы (slug)' });
    }
    if ((v.lat === '') !== (v.lng === '')) {
      ctx.addIssue({ code: 'custom', path: [v.lat === '' ? 'lat' : 'lng'], message: 'Нужны обе координаты' });
    }
    v.weekly_hours.forEach((day, index) => {
      if (!day.enabled) {
        return;
      }
      if (!TIME.test(day.open) || !TIME.test(day.close)) {
        ctx.addIssue({ code: 'custom', path: ['weekly_hours', index], message: 'Укажите время открытия и закрытия' });
      } else if (day.open >= day.close) {
        ctx.addIssue({ code: 'custom', path: ['weekly_hours', index], message: 'Открытие должно быть раньше закрытия' });
      }
    });
  });

export type ShowroomFormValues = z.infer<typeof showroomSchema>;

export function toShowroomForm(s: Showroom): ShowroomFormValues {
  return {
    name: s.name,
    slug: s.slug ?? '',
    city: s.city ?? '',
    address: s.address ?? '',
    area: s.area ?? '',
    floors: s.floors ?? '',
    sort_order: String(s.sort_order),
    is_flagship: s.is_flagship,
    show_on_site: s.show_on_site,
    landmark: { ...s.landmark },
    parking: { ...s.parking },
    description: { ...s.description },
    phone: s.phone ?? '',
    whatsapp: s.whatsapp ?? '',
    lat: s.lat === null ? '' : String(s.lat),
    lng: s.lng === null ? '' : String(s.lng),
    weekly_hours: s.weekly_hours.map((day) =>
      day ? { enabled: true, open: day.open, close: day.close } : { enabled: false, open: '10:00', close: '20:00' },
    ),
    services: [...s.services],
  };
}

/** Тело PUT /admin/showrooms/{id}. Пустые строки сервер сам превращает в null. */
export function toShowroomPayload(v: ShowroomFormValues) {
  return {
    ...v,
    sort_order: v.sort_order === '' ? 0 : Number(v.sort_order),
    lat: v.lat === '' ? null : Number(v.lat),
    lng: v.lng === '' ? null : Number(v.lng),
    weekly_hours: v.weekly_hours.map((day) => (day.enabled ? { open: day.open, close: day.close } : null)),
  };
}
