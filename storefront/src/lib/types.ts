// Mirrors of the Laravel API resources (app/Http/Resources + Public controllers).

export interface ProductImage {
  thumb: string;
  medium: string;
  full: string;
}

export interface ProductBrand {
  id: number;
  name: string | null;
  slug: string;
}

export interface ProductCharacteristic {
  name: string;
  slug: string;
  value: string;
}

export interface ProductVariant {
  id: number;
  external_id: string;
  name: string;
  characteristics: Record<string, unknown>;
  barcodes: string[];
  stock?: number;
  in_stock: boolean;
}

export interface ProductReview {
  id: number;
  name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ProductShort {
  id: number;
  video_url: string;
  thumbnail_url: string | null;
  title: string | null;
}

export interface ProductShowroom {
  store: {
    id: number;
    name: string;
    address: string | null;
  };
  stock: number;
}

export interface Product {
  id: number;
  external_id: string;
  name: string;
  slug: string | null;
  code: string | null;
  article: string | null;
  category_id: number | null;
  brand?: ProductBrand | null;
  images: ProductImage[];
  image: string | null;
  stock?: number;
  in_stock: boolean;
  price: number | null;
  old_price?: number | null;
  is_new?: boolean;
  b2b_min_order_qty?: number;
  external_folder_id?: string;
  country: string | null;
  supplier: string | null;
  barcodes: string[];
  attributes: Record<string, unknown>;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  variants?: ProductVariant[];
  characteristics?: ProductCharacteristic[];
  rating?: number;
  reviews_count?: number;
  reviews?: ProductReview[];
  shorts?: ProductShort[];
  showrooms?: ProductShowroom[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  children?: Category[];
  breadcrumb?: Array<Pick<Category, "id" | "name" | "slug">>;
}

export interface Banner {
  id: number;
  title: string | null;
  subtitle: string | null;
  url: string | null;
  image: string | null;
  image_mobile: string | null;
}

export interface HomeCollection {
  id: number;
  title: string;
  slug: string;
  products: Product[];
}

export interface HomeData {
  banners: Banner[];
  collections: HomeCollection[];
}

export interface ContentPage {
  slug: string;
  title: string;
  body?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  updated_at?: string | null;
}

export interface StoreInfo {
  id: number;
  name: string;
  address: string | null;
  is_default: boolean;
}

export interface Settings {
  delivery_price: number | null;
  free_delivery_from: number | null;
  contacts: {
    phone: string | null;
    email: string | null;
    address: string | null;
    whatsapp_url: string | null;
    instagram_url: string | null;
  };
  stores: StoreInfo[];
}

export interface FacetAttribute {
  name: string;
  slug: string;
  values: string[];
}

export interface FacetBrand {
  id: number;
  name: string | null;
  slug: string;
  count: number;
}

export interface Facets {
  attributes: FacetAttribute[];
  brands: FacetBrand[];
  price: { min: number | null; max: number | null };
}

export interface SitemapEntry {
  type: "product" | "category" | "page";
  slug: string;
  updated_at: string | null;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  type: "b2b" | "retail";
  company_name?: string | null;
  company_bin?: string | null;
  is_approved?: boolean;
}

export interface CartLineValidation {
  product_id: number;
  quantity: number;
  available: boolean;
  problem: "unavailable" | "no_price" | "insufficient_stock" | null;
  name: string | null;
  slug: string | null;
  article: string | null;
  image: string | null;
  price: number | null;
  stock: number;
}

export interface CartValidation {
  store_id: number | null;
  items: CartLineValidation[];
  subtotal: number;
  delivery_cost: number;
  total_with_delivery: number;
  total_pickup: number;
}

export interface OrderItem {
  id: number;
  product_id: number | null;
  name: string;
  quantity: number;
  price: number;
  image?: string | null;
  article?: string | null;
  slug?: string | null;
}

export interface Order {
  id: number;
  number: string;
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
  total: number;
  comment: string | null;
  contact_email: string | null;
  store_id: number | null;
  store_name?: string | null;
  store_address?: string | null;
  delivery_method: "pickup" | "delivery";
  delivery_cost: number;
  delivery_address?: {
    city: string | null;
    street: string | null;
    building: string | null;
    apartment: string | null;
    comment: string | null;
  };
  created_at: string;
  items?: OrderItem[];
}

export interface CheckoutResponse {
  data: Order;
  payment_url?: string;
}

export interface Address {
  id: number;
  city: string;
  street: string;
  building: string;
  apartment: string | null;
  comment: string | null;
  is_default: boolean;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}
