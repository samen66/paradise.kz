'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { tiynToTenge } from '@/lib/money';
import ProductRelations from '@/components/products/ProductRelations';

type Option = { id: number; name?: { ru?: string; kk?: string } | string };

const optionLabel = (o: Option): string =>
  (typeof o.name === 'string' ? o.name : o.name?.ru) || `#${o.id}`;

const inputClass =
  'w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';

const emptyForm = {
  name_ru: '',
  name_kk: '',
  description_ru: '',
  description_kk: '',
  slug: '',
  seo_title_ru: '',
  seo_title_kk: '',
  seo_description_ru: '',
  seo_description_kk: '',
  code: '',
  article: '',
  category_id: '',
  brand_id: '',
  retail_price: '',
  b2b_price: '',
  compare_at_price: '',
  min_price: '',
  purchase_price: '',
  b2b_min_order_qty: '',
  uom: '',
  weight: '',
  volume: '',
  country: '',
  supplier: '',
  is_active: true,
  is_new_arrival: false,
};

/** Flat scalars sent on every save; blank means "clear this field". */
const SCALAR_FIELDS = [
  'slug',
  'code',
  'article',
  'category_id',
  'brand_id',
  'retail_price',
  'b2b_price',
  'compare_at_price',
  'min_price',
  'purchase_price',
  'b2b_min_order_qty',
  'uom',
  'weight',
  'volume',
  'country',
  'supplier',
] as const;

export default function EditProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const isCreate = id === 'create';

  const [isLoading, setIsLoading] = useState(!isCreate);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);

  const [formData, setFormData] = useState(emptyForm);

  // Read-only: a projection of the FIFO ledger, moved by receipts and orders.
  const [stock, setStock] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          api.get('/admin/categories'),
          api.get('/admin/brands'),
        ]);
        setCategories(catRes.data?.data || catRes.data || []);
        setBrands(brandRes.data?.data || brandRes.data || []);
      } catch {
        console.error('Could not fetch categories/brands');
      }
    };

    fetchOptions();

    if (!isCreate) {
      const fetchProduct = async () => {
        try {
          const res = await api.get(`/admin/products/${id}`);
          const p = res.data?.data || res.data;
          if (p) {
            setFormData({
              name_ru: p.name?.ru || '',
              name_kk: p.name?.kk || '',
              description_ru: p.description?.ru || '',
              description_kk: p.description?.kk || '',
              slug: p.slug || '',
              seo_title_ru: p.seo_title?.ru || '',
              seo_title_kk: p.seo_title?.kk || '',
              seo_description_ru: p.seo_description?.ru || '',
              seo_description_kk: p.seo_description?.kk || '',
              code: p.code || '',
              article: p.article || '',
              category_id: p.category_id ? String(p.category_id) : '',
              brand_id: p.brand_id ? String(p.brand_id) : '',
              retail_price: tiynToTenge(p.retail_price),
              b2b_price: tiynToTenge(p.b2b_price),
              compare_at_price: tiynToTenge(p.compare_at_price),
              min_price: tiynToTenge(p.min_price),
              purchase_price: tiynToTenge(p.purchase_price),
              b2b_min_order_qty: p.b2b_min_order_qty ? String(p.b2b_min_order_qty) : '',
              uom: p.uom || '',
              weight: p.weight === null || p.weight === undefined ? '' : String(p.weight),
              volume: p.volume === null || p.volume === undefined ? '' : String(p.volume),
              country: p.country || '',
              supplier: p.supplier || '',
              is_active: p.is_active ?? true,
              is_new_arrival: p.is_new_arrival ?? false,
            });
            setStock(p.stock === null || p.stock === undefined ? null : String(p.stock));
          }
        } catch (error) {
          console.error('Failed to fetch product', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchProduct();
    }
  }, [id, isCreate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const data = new FormData();
      data.append('name[ru]', formData.name_ru);
      if (formData.name_kk) data.append('name[kk]', formData.name_kk);

      if (formData.description_ru) data.append('description[ru]', formData.description_ru);
      if (formData.description_kk) data.append('description[kk]', formData.description_kk);

      if (formData.seo_title_ru) data.append('seo_title[ru]', formData.seo_title_ru);
      if (formData.seo_title_kk) data.append('seo_title[kk]', formData.seo_title_kk);
      if (formData.seo_description_ru) data.append('seo_description[ru]', formData.seo_description_ru);
      if (formData.seo_description_kk) data.append('seo_description[kk]', formData.seo_description_kk);

      // Sent even when blank so that clearing a field in the UI clears it on
      // the server; the request turns "" into null.
      SCALAR_FIELDS.forEach((field) => {
        data.append(field, String(formData[field] ?? ''));
      });

      data.append('is_active', formData.is_active ? '1' : '0');
      data.append('is_new_arrival', formData.is_new_arrival ? '1' : '0');

      let url = `/admin/products`;
      if (!isCreate) {
        url += `/${id}`;
        data.append('_method', 'PUT'); // Laravel requirement for multipart PUT
      }

      const res = await api.post(url, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (isCreate && res.status === 201) {
        router.push(`/products/${res.data.data.id}`);
      } else if (res.status === 200) {
        router.push('/products');
      }
    } catch (error: any) {
      console.error('Failed to save', error);
      if (error.response?.data) {
        const err = error.response.data;
        alert('Validation failed: ' + JSON.stringify(err.errors || err.message));
      } else {
        alert('An error occurred while saving.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]"></div>
      </div>
    );
  }

  const field = (label: string, children: React.ReactNode, hint?: string) => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );

  return (
    <div className="text-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/products" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isCreate ? 'Add New Product' : 'Edit Product'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ---------------------------------------------------------- Basic */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Name (RU) *',
                <input required name="name_ru" value={formData.name_ru} onChange={handleChange} className={inputClass} placeholder="Enter product name in Russian" />,
              )}
              {field('Name (KK)',
                <input name="name_kk" value={formData.name_kk} onChange={handleChange} className={inputClass} placeholder="Enter product name in Kazakh" />,
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Category',
                <select name="category_id" value={formData.category_id} onChange={handleChange} className={`${inputClass} appearance-none`}>
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{optionLabel(c)}</option>
                  ))}
                </select>,
              )}
              {field('Brand',
                <select name="brand_id" value={formData.brand_id} onChange={handleChange} className={`${inputClass} appearance-none`}>
                  <option value="">Select a brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{optionLabel(b)}</option>
                  ))}
                </select>,
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Code (SKU)',
                <input name="code" value={formData.code} onChange={handleChange} className={inputClass} placeholder="e.g. 00123" />,
              )}
              {field('Article',
                <input name="article" value={formData.article} onChange={handleChange} className={inputClass} placeholder="e.g. ART-0042" />,
              )}
            </div>

            <div className="flex flex-wrap gap-8">
              <label className="relative flex items-center cursor-pointer gap-3">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="text-sm font-medium text-gray-700">Active (visible in catalog)</span>
              </label>

              <label className="relative flex items-center cursor-pointer gap-3">
                <input type="checkbox" name="is_new_arrival" checked={formData.is_new_arrival} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="text-sm font-medium text-gray-700">New arrival</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Description (RU)',
                <textarea name="description_ru" value={formData.description_ru} onChange={handleChange} rows={4} className={`${inputClass} resize-y`} placeholder="Product description in Russian" />,
              )}
              {field('Description (KK)',
                <textarea name="description_kk" value={formData.description_kk} onChange={handleChange} rows={4} className={`${inputClass} resize-y`} placeholder="Product description in Kazakh" />,
              )}
            </div>
          </div>

          {/* --------------------------------------------------------- Pricing */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <div className="border-b pb-2">
              <h2 className="text-lg font-semibold">Pricing</h2>
              <p className="text-xs text-gray-500 mt-1">All amounts in ₸, up to two decimals.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {field('Retail price (₸)',
                <input type="number" step="0.01" min="0" name="retail_price" value={formData.retail_price} onChange={handleChange} className={inputClass} placeholder="0" />,
              )}
              {field('B2B price (₸)',
                <input type="number" step="0.01" min="0" name="b2b_price" value={formData.b2b_price} onChange={handleChange} className={inputClass} placeholder="0" />,
              )}
              {field('Compare-at price (₸)',
                <input type="number" step="0.01" min="0" name="compare_at_price" value={formData.compare_at_price} onChange={handleChange} className={inputClass} placeholder="0" />,
                'Shown as the struck-through "old price" when it is above the current one.',
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {field('Minimum price (₸)',
                <input type="number" step="0.01" min="0" name="min_price" value={formData.min_price} onChange={handleChange} className={inputClass} placeholder="0" />,
                'Floor for per-client discounts.',
              )}
              {field('Purchase price (₸)',
                <input type="number" step="0.01" min="0" name="purchase_price" value={formData.purchase_price} onChange={handleChange} className={inputClass} placeholder="0" />,
              )}
              {field('B2B min. order qty',
                <input type="number" step="1" min="1" name="b2b_min_order_qty" value={formData.b2b_min_order_qty} onChange={handleChange} className={inputClass} placeholder="Default" />,
                'Blank falls back to the global catalog default.',
              )}
            </div>

            {!isCreate && (
              <div className="flex items-baseline gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                <span className="text-sm font-medium text-gray-700">On hand:</span>
                <span className="text-sm font-semibold text-gray-900">{stock ?? '—'}</span>
                <span className="text-xs text-gray-500">
                  read-only — moved by goods receipts and orders, not by this form.
                </span>
                <Link href="/stock" className="text-xs text-blue-600 hover:underline ml-auto">
                  Stock by warehouse →
                </Link>
              </div>
            )}
          </div>

          {/* -------------------------------------------------- Specifications */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">Specifications</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {field('Unit of measure',
                <input name="uom" value={formData.uom} onChange={handleChange} className={inputClass} placeholder="шт" />,
              )}
              {field('Weight (kg)',
                <input type="number" step="0.001" min="0" name="weight" value={formData.weight} onChange={handleChange} className={inputClass} placeholder="0.000" />,
              )}
              {field('Volume (m³)',
                <input type="number" step="0.001" min="0" name="volume" value={formData.volume} onChange={handleChange} className={inputClass} placeholder="0.000" />,
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Country of origin',
                <input name="country" value={formData.country} onChange={handleChange} className={inputClass} placeholder="Казахстан" />,
              )}
              {field('Supplier',
                <input name="supplier" value={formData.supplier} onChange={handleChange} className={inputClass} placeholder="ТОО Поставщик" />,
              )}
            </div>
          </div>

          {/* ------------------------------------------------------------- SEO */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">SEO</h2>

            {field('Slug',
              <input name="slug" value={formData.slug} onChange={handleChange} className={inputClass} placeholder="divan-atlanta" />,
              'Lowercase latin letters, digits and dashes. Leave blank to generate it from the Russian name; changing it later breaks existing links.',
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Meta title (RU)',
                <input name="seo_title_ru" value={formData.seo_title_ru} onChange={handleChange} className={inputClass} placeholder="Falls back to the product name" />,
              )}
              {field('Meta title (KK)',
                <input name="seo_title_kk" value={formData.seo_title_kk} onChange={handleChange} className={inputClass} placeholder="Falls back to the product name" />,
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {field('Meta description (RU)',
                <textarea name="seo_description_ru" value={formData.seo_description_ru} onChange={handleChange} rows={3} className={`${inputClass} resize-y`} placeholder="Up to ~160 characters" />,
              )}
              {field('Meta description (KK)',
                <textarea name="seo_description_kk" value={formData.seo_description_kk} onChange={handleChange} rows={3} className={`${inputClass} resize-y`} placeholder="Up to ~160 characters" />,
              )}
            </div>
          </div>

          {isCreate && (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
              Фото, цены по типам, цены клиентов, характеристики и варианты появятся после сохранения товара.
            </p>
          )}

          <div className="flex justify-end gap-4 pb-12">
            <Link
              href="/products"
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-70 flex items-center"
            >
              {isSaving && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              )}
              {isSaving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>

        {!isCreate && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-12">
            <ProductRelations productId={Number(id)} />
          </div>
        )}
      </div>
    </div>
  );
}
