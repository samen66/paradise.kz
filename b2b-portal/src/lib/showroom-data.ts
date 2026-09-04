// Shared showroom + product dataset and pure helpers for Paradise.kz.
// Migrated from JS to TS for the Showrooms implementation.

export function img(seed: string) {
  return {
    thumb: `https://picsum.photos/seed/${seed}/200/200`,
    medium: `https://picsum.photos/seed/${seed}/600/600`,
    full: `https://picsum.photos/seed/${seed}/1200/1200`
  };
}

export function formatPrice(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₸";
}

// --- Product catalog ------------------------------------------------------
export const PRODUCTS = [
  { id: 101, name: "Диван Milan прямой, 3-местный", article: "MIL-3S-GRY", price: 389900, oldPrice: 486900, stock: 6, seed: "sofa-milan-1", cat: "Диваны", brand: "Ambianta" },
  { id: 102, name: "Диван Bergen угловой, левый угол", article: "BRG-U-BEG", price: 512000, stock: 3, seed: "sofa-bergen-1", cat: "Диваны", brand: "NordHome" },
  { id: 103, name: "Диван-кровать Nova, еврокнижка", article: "NOV-EK-BLU", price: 268500, oldPrice: 315000, stock: 9, seed: "sofa-nova-1", cat: "Диваны", brand: "Ambianta" },
  { id: 104, name: "Кресло Oslo мягкое", article: "OSL-CHR-GRN", price: 145900, stock: 5, seed: "chair-oslo-1", cat: "Кресла", brand: "NordHome" },
  { id: 105, name: "Диван Sofia классический, 2-местный", article: "SOF-2S-CRM", price: 298000, stock: 4, seed: "sofa-sofia-1", cat: "Диваны", brand: "Ambianta" },
  { id: 106, name: "Тумба ТВ Lund, дуб сонома", article: "LND-TV-OAK", price: 87500, oldPrice: 102000, stock: 12, seed: "tv-lund-1", cat: "Тумбы под ТВ", brand: "NordHome" },
  { id: 107, name: "Диван Roma угловой, правый угол", article: "ROM-U-GRY", price: 445000, oldPrice: 499000, stock: 2, seed: "sofa-roma-1", cat: "Диваны", brand: "Ambianta" },
  { id: 108, name: "Пуф Vento велюровый", article: "VNT-PF-MST", price: 42900, stock: 18, seed: "pouf-vento-1", cat: "Пуфы", brand: "Ambianta" },
  { id: 109, name: "Кресло офисное Ergo Pro", article: "ERG-PRO-BLK", price: 128000, stock: 14, seed: "chair-ergo-1", cat: "Офисные кресла", brand: "NordHome" },
  { id: 110, name: "Кровать Aura с подъёмным механизмом, 160×200", article: "AUR-BED-160", price: 342000, oldPrice: 398000, stock: 7, seed: "bed-aura-1", cat: "Кровати", brand: "Ambianta" },
  { id: 111, name: "Шкаф-купе Lund, 3 двери", article: "LND-WR-3D", price: 276000, stock: 5, seed: "wardrobe-lund-1", cat: "Шкафы", brand: "NordHome" },
  { id: 112, name: "Стол обеденный Nordic, раздвижной", article: "NRD-DT-EXT", price: 158000, stock: 10, seed: "table-nordic-1", cat: "Столы", brand: "NordHome" },
  { id: 113, name: "Комод Verona, 5 ящиков", article: "VRN-CH-5", price: 96500, stock: 8, seed: "dresser-verona-1", cat: "Комоды", brand: "Ambianta" },
  { id: 114, name: "Стулья Vinci, велюр (комплект 2 шт)", article: "VNC-CH-SET2", price: 68000, stock: 22, seed: "chair-vinci-1", cat: "Стулья", brand: "Ambianta" }
];

const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
export function productById(id: number) { return PRODUCT_BY_ID[id]; }

export function cardPropsFor(p: any) {
  return {
    product: {
      id: p.id, external_id: p.article.toLowerCase(), name: p.name, slug: p.article.toLowerCase(),
      code: `P-${p.id}`, article: p.article, category_id: 12,
      brand: { id: 4, name: p.brand || "Ambianta", slug: "ambianta" },
      images: [img(p.seed)], image: img(p.seed).medium,
      stock: p.stock, in_stock: p.stock > 0, price: p.price,
      country: "Казахстан", supplier: "Ambianta Furniture", barcodes: [], attributes: {}
    }
  };
}

// --- Availability status meta --------------------------------------------
// status: "in" | "low" | "order" | "sample"
export function statusMeta(status: string, qty?: number) {
  switch (status) {
    case "in":     return { key: "in",     label: "В наличии",            bg: "#e3f3ea", color: "#1d6b4f", dot: "#2f9e6f" };
    case "low":    return { key: "low",     label: qty ? `Мало · ${qty} шт` : "Мало", bg: "#f6efe3", color: "#a9631a", dot: "#d08a2e" };
    case "order":  return { key: "order",  label: "Под заказ",            bg: "#eef1f8", color: "#4a5bb0", dot: "#5b6ee0" };
    case "sample": return { key: "sample", label: "Выставочный образец",  bg: "#f2ecf7", color: "#7b4fa8", dot: "#9a6fc4" };
    default:       return { key: "none",   label: "Нет в наличии",         bg: "#f0eee9", color: "#8a8477", dot: "#c2bcb1" };
  }
}

// --- Showrooms ------------------------------------------------------------
// weekly: 7 entries, Mon→Sun. {o,c} open/close "HH:MM", or null = closed.
const W_10_21 = Array(7).fill({ o: "10:00", c: "21:00" });
function weekly(weekdays: {o: string, c: string}, weekend: {o: string, c: string} | null) {
  return [weekdays, weekdays, weekdays, weekdays, weekdays, weekend, weekend];
}

export type ShowroomItem = { productId: number, status: string, qty?: number };

export type Showroom = {
  id: number;
  slug: string;
  flagship?: boolean;
  name: string;
  city: string;
  citySlug: string;
  district: string;
  address: string;
  landmark: string;
  parking: string;
  phone: string;
  phoneHref: string;
  whatsapp: string;
  lat: number;
  lng: number;
  area: string;
  floors: string;
  mx: number;
  my: number;
  rating: number;
  reviews: number;
  cover: string;
  gallery: string[];
  weekly: ({o: string, c: string} | null)[];
  services: string[];
  items: ShowroomItem[];
};

export const SHOWROOMS: Showroom[] = [
  {
    id: 1, slug: "raiymbek", flagship: true,
    name: "Гипермаркет Paradise на Райымбека",
    city: "Алматы", citySlug: "almaty", district: "Алмалинский район",
    address: "пр. Райымбека, 212", landmark: "5 минут от ст. м. «Райымбек батыра»",
    parking: "Бесплатная парковка на 120 мест",
    phone: "+7 (727) 355-11-00", phoneHref: "+77273551100", whatsapp: "77001112233",
    lat: 43.27350, lng: 76.94300, area: "3 200 м²", floors: "2 этажа",
    mx: 34, my: 30, rating: 4.8, reviews: 1240,
    cover: "showroom-raiymbek", gallery: ["showroom-raiymbek", "showroom-raiymbek-2", "showroom-raiymbek-3", "showroom-raiymbek-4"],
    weekly: weekly({ o: "10:00", c: "22:00" }, { o: "10:00", c: "22:00" }),
    services: ["pickup", "consult", "card", "kids", "cafe", "assembly"],
    items: [
      { productId: 101, status: "in", qty: 6 }, { productId: 102, status: "in", qty: 3 },
      { productId: 103, status: "in", qty: 5 }, { productId: 107, status: "low", qty: 2 },
      { productId: 110, status: "in", qty: 4 }, { productId: 111, status: "in", qty: 3 },
      { productId: 112, status: "in", qty: 6 }, { productId: 104, status: "in", qty: 5 },
      { productId: 106, status: "in", qty: 8 }, { productId: 108, status: "in", qty: 10 },
      { productId: 113, status: "low", qty: 2 }, { productId: 109, status: "in", qty: 7 }
    ]
  },
  {
    id: 2, slug: "mega-almaty",
    name: "Paradise в ТРЦ Mega Alma-Ata",
    city: "Алматы", citySlug: "almaty", district: "Бостандыкский район",
    address: "ул. Розыбакиева, 247а, 2 этаж", landmark: "ТРЦ MEGA Alma-Ata, зона фудкорта",
    parking: "Крытый паркинг ТРЦ",
    phone: "+7 (727) 355-11-02", phoneHref: "+77273551102", whatsapp: "77001112234",
    lat: 43.22000, lng: 76.89300, area: "780 м²", floors: "1 этаж",
    mx: 58, my: 62, rating: 4.7, reviews: 612,
    cover: "showroom-mega", gallery: ["showroom-mega", "showroom-mega-2", "showroom-mega-3"],
    weekly: W_10_21,
    services: ["pickup", "consult", "card", "kids"],
    items: [
      { productId: 101, status: "low", qty: 2 }, { productId: 105, status: "in", qty: 4 },
      { productId: 103, status: "in", qty: 3 }, { productId: 106, status: "in", qty: 5 },
      { productId: 108, status: "in", qty: 6 }, { productId: 104, status: "low", qty: 1 },
      { productId: 114, status: "in", qty: 12 }, { productId: 113, status: "in", qty: 4 }
    ]
  },
  {
    id: 3, slug: "esentai",
    name: "Paradise Есентай",
    city: "Алматы", citySlug: "almaty", district: "Медеуский район",
    address: "пр. Аль-Фараби, 77/8", landmark: "ТРЦ Esentai Mall, 3 этаж",
    parking: "Многоуровневый паркинг",
    phone: "+7 (727) 355-11-05", phoneHref: "+77273551105", whatsapp: "77001112235",
    lat: 43.22050, lng: 76.92800, area: "540 м²", floors: "1 этаж",
    mx: 72, my: 40, rating: 4.9, reviews: 388,
    cover: "showroom-esentai", gallery: ["showroom-esentai", "showroom-esentai-2", "showroom-esentai-3"],
    weekly: weekly({ o: "10:00", c: "22:00" }, { o: "10:00", c: "22:00" }),
    services: ["consult", "card", "cafe"],
    items: [
      { productId: 101, status: "order" }, { productId: 102, status: "in", qty: 2 },
      { productId: 107, status: "in", qty: 2 }, { productId: 110, status: "in", qty: 3 },
      { productId: 111, status: "low", qty: 1 }, { productId: 112, status: "in", qty: 4 }
    ]
  },
  {
    id: 4, slug: "astana-khan-shatyr", flagship: true,
    name: "Paradise Астана · Хан Шатыр",
    city: "Астана", citySlug: "astana", district: "район Есиль",
    address: "пр. Туран, 37", landmark: "напротив ТРЦ «Хан Шатыр»",
    parking: "Наземная парковка на 80 мест",
    phone: "+7 (7172) 22-33-44", phoneHref: "+77172223344", whatsapp: "77001112236",
    lat: 51.13250, lng: 71.40330, area: "2 100 м²", floors: "2 этажа",
    mx: 40, my: 44, rating: 4.8, reviews: 734,
    cover: "showroom-astana", gallery: ["showroom-astana", "showroom-astana-2", "showroom-astana-3", "showroom-astana-4"],
    weekly: W_10_21,
    services: ["pickup", "consult", "card", "kids", "assembly"],
    items: [
      { productId: 101, status: "sample" }, { productId: 102, status: "in", qty: 4 },
      { productId: 105, status: "in", qty: 3 }, { productId: 110, status: "in", qty: 5 },
      { productId: 111, status: "in", qty: 4 }, { productId: 112, status: "in", qty: 3 },
      { productId: 113, status: "in", qty: 6 }, { productId: 109, status: "in", qty: 9 }
    ]
  },
  {
    id: 5, slug: "astana-saryarka",
    name: "Paradise Астана · Сарыарка",
    city: "Астана", citySlug: "astana", district: "район Сарыарка",
    address: "ул. Пушкина, 20", landmark: "ТД «Артём», 1 этаж",
    parking: "Парковка вдоль улицы",
    phone: "+7 (7172) 22-33-46", phoneHref: "+77172223346", whatsapp: "77001112237",
    lat: 51.18100, lng: 71.44000, area: "620 м²", floors: "1 этаж",
    mx: 64, my: 26, rating: 4.6, reviews: 205,
    cover: "showroom-saryarka", gallery: ["showroom-saryarka", "showroom-saryarka-2", "showroom-saryarka-3"],
    weekly: weekly({ o: "10:00", c: "20:00" }, { o: "10:00", c: "19:00" }),
    services: ["pickup", "consult", "card"],
    items: [
      { productId: 103, status: "in", qty: 3 }, { productId: 104, status: "in", qty: 4 },
      { productId: 106, status: "in", qty: 5 }, { productId: 108, status: "in", qty: 7 },
      { productId: 114, status: "in", qty: 8 }, { productId: 113, status: "low", qty: 2 }
    ]
  },
  {
    id: 6, slug: "shymkent",
    name: "Paradise Шымкент",
    city: "Шымкент", citySlug: "shymkent", district: "Аль-Фарабийский район",
    address: "пр. Тауке хана, 51", landmark: "ТРЦ Shymkent Plaza, 2 этаж",
    parking: "Крытый паркинг ТРЦ",
    phone: "+7 (7252) 55-66-77", phoneHref: "+77252556677", whatsapp: "77001112238",
    lat: 42.31700, lng: 69.59600, area: "910 м²", floors: "1 этаж",
    mx: 46, my: 54, rating: 4.7, reviews: 296,
    cover: "showroom-shymkent", gallery: ["showroom-shymkent", "showroom-shymkent-2", "showroom-shymkent-3"],
    weekly: W_10_21,
    services: ["pickup", "consult", "card", "kids"],
    items: [
      { productId: 101, status: "in", qty: 4 }, { productId: 105, status: "in", qty: 5 },
      { productId: 103, status: "in", qty: 3 }, { productId: 106, status: "low", qty: 2 },
      { productId: 108, status: "in", qty: 9 }, { productId: 110, status: "order" },
      { productId: 112, status: "in", qty: 4 }, { productId: 114, status: "in", qty: 10 }
    ]
  }
];

const SHOWROOM_BY_SLUG = Object.fromEntries(SHOWROOMS.map(s => [s.slug, s]));
export function showroomBySlug(slug: string) { return SHOWROOM_BY_SLUG[slug]; }

export const SERVICE_LABELS: Record<string, string> = {
  pickup:  "Самовывоз",
  consult: "Шоу-рум консультация",
  card:    "Оплата картой",
  kids:    "Детская зона",
  cafe:    "Кофе-зона",
  assembly:"Заказ сборки"
};

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export { DAY_LABELS };

// Compute "open now" from real client time. Mon→Sun schedule.
export function openStatus(sh: Showroom, now?: Date) {
  now = now || new Date();
  const jsDay = now.getDay();            // 0=Sun..6=Sat
  const idx = (jsDay + 6) % 7;           // 0=Mon..6=Sun
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const today = sh.weekly[idx];
  if (today && mins >= toMin(today.o) && mins < toMin(today.c)) {
    return { open: true, label: "Открыто", sub: `до ${today.c}` };
  }
  if (today && mins < toMin(today.o)) {
    return { open: false, label: "Закрыто", sub: `откроется сегодня в ${today.o}` };
  }
  // find next open day
  for (let i = 1; i <= 7; i++) {
    const d = sh.weekly[(idx + i) % 7];
    if (d) return { open: false, label: "Закрыто", sub: `откроется в ${DAY_LABELS[(idx + i) % 7]} в ${d.o}` };
  }
  return { open: false, label: "Закрыто", sub: "" };
}

// Collapse the weekly array into readable rows, grouping equal consecutive days.
export function scheduleRows(sh: Showroom) {
  const rows = [];
  const key = (d: {o: string, c: string} | null) => (d ? `${d.o}-${d.c}` : "closed");
  let start = 0;
  for (let i = 1; i <= 7; i++) {
    if (i === 7 || key(sh.weekly[i]) !== key(sh.weekly[start])) {
      const d = sh.weekly[start];
      const range = start === i - 1 ? DAY_LABELS[start] : `${DAY_LABELS[start]}–${DAY_LABELS[i - 1]}`;
      rows.push({ range, hours: d ? `${d.o}–${d.c}` : "Выходной", open: !!d });
      start = i;
    }
  }
  return rows;
}

// External route link (2GIS, popular in KZ). Opens directions to the point.
export function routeUrl(sh: Showroom) {
  return `https://2gis.kz/${sh.citySlug}/directions/points/%7C${sh.lng}%2C${sh.lat}%3B`;
}
export function mapUrl(sh: Showroom) {
  return `https://2gis.kz/${sh.citySlug}/geo/${sh.lng}%2C${sh.lat}`;
}
export function whatsappUrl(sh: Showroom) {
  return `https://wa.me/${sh.whatsapp}`;
}

// Showrooms that stock a given product, newest-status-first for the product page.
export function showroomsWithProduct(productId: number) {
  const order: Record<string, number> = { in: 0, low: 1, sample: 2, order: 3 };
  return SHOWROOMS
    .map(sh => {
      const it = sh.items.find(i => i.productId === productId);
      return it ? { showroom: sh, status: it.status, qty: it.qty } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (order[a!.status] ?? 9) - (order[b!.status] ?? 9));
}
