// Shared realistic sample data for design-sync preview authoring
// (.design-sync/previews/*.tsx). Not part of the app — repo-owned fixture
// data mirroring src/lib/types.ts, used only to give preview cards
// realistic content instead of "foo"/"test" placeholders.
import type { Category, Facets, Product, Settings } from "@/lib/types";

function img(seed: string): { thumb: string; medium: string; full: string } {
  return {
    thumb: `https://picsum.photos/seed/${seed}/200/200`,
    medium: `https://picsum.photos/seed/${seed}/600/600`,
    full: `https://picsum.photos/seed/${seed}/1200/1200`,
  };
}

export const sampleProducts: Product[] = [
  {
    id: 101,
    external_id: "sofa-milan-3s",
    name: "Диван Milan прямой, 3-местный",
    slug: "divan-milan-3-mestnyy",
    code: "SOF-101",
    article: "MIL-3S-GRY",
    category_id: 12,
    brand: { id: 4, name: "Ambianta", slug: "ambianta" },
    images: [img("sofa-milan-1"), img("sofa-milan-2"), img("sofa-milan-3")],
    image: img("sofa-milan-1").medium,
    stock: 6,
    in_stock: true,
    price: 389900,
    b2b_min_order_qty: 1,
    country: "Казахстан",
    supplier: "Ambianta Furniture",
    barcodes: ["4870012345671"],
    attributes: { color: "Серый", material: "Велюр" },
    description:
      "Прямой диван Milan с раскладным механизмом еврокнижка и вместительным бельевым ящиком. Каркас — массив сосны и ЛДСП, обивка — износостойкий велюр.",
    characteristics: [
      { name: "Цвет", slug: "color", value: "Серый" },
      { name: "Материал обивки", slug: "material", value: "Велюр" },
      { name: "Механизм раскладывания", slug: "mechanism", value: "Еврокнижка" },
      { name: "Ширина", slug: "width", value: "212 см" },
    ],
    variants: [
      { id: 1011, external_id: "sofa-milan-3s-gry", name: "Серый", characteristics: { color: "Серый" }, barcodes: [], stock: 6, in_stock: true },
      { id: 1012, external_id: "sofa-milan-3s-beg", name: "Бежевый", characteristics: { color: "Бежевый" }, barcodes: [], stock: 0, in_stock: false },
    ],
  },
  {
    id: 102,
    external_id: "wardrobe-oslo-3d",
    name: "Шкаф Oslo 3-дверный с зеркалом",
    slug: "shkaf-oslo-3-dvernyy",
    code: "WRD-102",
    article: "OSL-3D-WHT",
    category_id: 15,
    brand: { id: 7, name: "NordHome", slug: "nordhome" },
    images: [img("wardrobe-oslo-1"), img("wardrobe-oslo-2")],
    image: img("wardrobe-oslo-1").medium,
    stock: 3,
    in_stock: true,
    price: 214500,
    b2b_min_order_qty: 1,
    country: "Беларусь",
    supplier: "NordHome",
    barcodes: ["4870019876543"],
    attributes: { color: "Белый" },
    description: "Вместительный шкаф с зеркальной дверью, двумя штангами и системой полок.",
    characteristics: [
      { name: "Цвет", slug: "color", value: "Белый" },
      { name: "Материал", slug: "material", value: "ЛДСП" },
      { name: "Количество дверей", slug: "doors", value: "3" },
    ],
  },
  {
    id: 103,
    external_id: "table-kitchen-round-90",
    name: "Стол кухонный Round, Ø90 см",
    slug: "stol-kuhonnyy-round-90",
    code: "TBL-103",
    article: "RND-90-OAK",
    category_id: 21,
    brand: null,
    images: [img("table-round-1")],
    image: img("table-round-1").medium,
    stock: 0,
    in_stock: false,
    price: 74900,
    country: "Казахстан",
    supplier: "Мебель KZ",
    barcodes: [],
    attributes: { color: "Дуб сонома" },
    characteristics: [
      { name: "Цвет", slug: "color", value: "Дуб сонома" },
      { name: "Форма", slug: "shape", value: "Круглый" },
    ],
  },
  {
    id: 104,
    external_id: "chair-office-ergo",
    name: "Кресло офисное Ergo Pro",
    slug: "kreslo-ofisnoe-ergo-pro",
    code: "CHR-104",
    article: "ERG-PRO-BLK",
    category_id: 30,
    brand: { id: 9, name: "WorkLine", slug: "workline" },
    images: [img("chair-ergo-1"), img("chair-ergo-2")],
    image: img("chair-ergo-1").medium,
    stock: 14,
    in_stock: true,
    price: 128000,
    b2b_min_order_qty: 5,
    country: "Китай",
    supplier: "WorkLine",
    barcodes: ["4870055566677"],
    attributes: { color: "Чёрный" },
    description: "Эргономичное кресло с поясничной поддержкой и регулируемыми подлокотниками.",
    characteristics: [
      { name: "Цвет", slug: "color", value: "Чёрный" },
      { name: "Материал", slug: "material", value: "Сетка/Экокожа" },
      { name: "Максимальная нагрузка", slug: "load", value: "130 кг" },
    ],
  },
];

export const sampleProduct = sampleProducts[0];
export const sampleOutOfStockProduct = sampleProducts[2];

export const sampleCategories: Category[] = [
  {
    id: 10,
    name: "Гостиная",
    slug: "gostinaya",
    parent_id: null,
    children: [
      { id: 12, name: "Диваны", slug: "divany", parent_id: 10 },
      { id: 13, name: "Кресла", slug: "kresla", parent_id: 10 },
      { id: 14, name: "Тумбы под ТВ", slug: "tumby-pod-tv", parent_id: 10 },
    ],
  },
  {
    id: 15,
    name: "Спальня",
    slug: "spalnya",
    parent_id: null,
    children: [
      { id: 16, name: "Кровати", slug: "krovati", parent_id: 15 },
      { id: 17, name: "Шкафы", slug: "shkafy", parent_id: 15 },
      { id: 18, name: "Комоды", slug: "komody", parent_id: 15 },
    ],
  },
  {
    id: 20,
    name: "Кухня",
    slug: "kuhnya",
    parent_id: null,
    children: [
      { id: 21, name: "Столы", slug: "stoly", parent_id: 20 },
      { id: 22, name: "Стулья", slug: "stulya", parent_id: 20 },
    ],
  },
  {
    id: 30,
    name: "Офис",
    slug: "ofis",
    parent_id: null,
    children: [{ id: 31, name: "Офисные кресла", slug: "ofisnye-kresla", parent_id: 30 }],
  },
];

export const sampleBreadcrumb = [
  { id: 10, name: "Гостиная", slug: "gostinaya" },
  { id: 12, name: "Диваны", slug: "divany" },
];

export const sampleSettings: Settings = {
  delivery_price: 3500,
  free_delivery_from: 200000,
  contacts: {
    phone: "+7 (727) 123-45-67",
    email: "info@paradise.kz",
    address: "г. Алматы, пр. Райымбека, 212",
    whatsapp_url: "https://wa.me/77271234567",
    instagram_url: "https://instagram.com/paradise.kz",
  },
  stores: [
    { id: 1, name: "Гипермаркет на Райымбека", address: "г. Алматы, пр. Райымбека, 212", is_default: true },
    { id: 2, name: "ТЦ Мега Алматы", address: "г. Алматы, ул. Розыбакиева, 247а", is_default: false },
  ],
};

export const sampleFacets: Facets = {
  attributes: [
    { name: "Цвет", slug: "color", values: ["Серый", "Белый", "Чёрный", "Дуб сонома"] },
    { name: "Материал", slug: "material", values: ["Велюр", "Экокожа", "ЛДСП"] },
  ],
  brands: [
    { id: 4, name: "Ambianta", slug: "ambianta", count: 18 },
    { id: 7, name: "NordHome", slug: "nordhome", count: 9 },
    { id: 9, name: "WorkLine", slug: "workline", count: 5 },
  ],
  price: { min: 15000, max: 950000 },
};
