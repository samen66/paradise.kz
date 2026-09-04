'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function EditProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const isCreate = id === 'create';
  
  const [isLoading, setIsLoading] = useState(!isCreate);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  
  const [formData, setFormData] = useState({
    name_ru: '',
    name_kk: '',
    name_en: '',
    description_ru: '',
    description_kk: '',
    description_en: '',
    retail_price: '',
    b2b_price: '',
    category_id: '',
    brand_id: '',
    is_active: true,
  });
  
  const [images, setImages] = useState<File[]>([]);
  const [currentMedia, setCurrentMedia] = useState<any[]>([]);

  useEffect(() => {
    // Fetch categories for the select dropdown
    const fetchOptions = async () => {
      try {
        const catRes = await api.get('/public/categories');
        setCategories(catRes.data?.data || catRes.data || []);
      } catch (err) {
        console.error('Could not fetch categories');
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
              name_en: p.name?.en || '',
              description_ru: p.description?.ru || '',
              description_kk: p.description?.kk || '',
              description_en: p.description?.en || '',
              retail_price: p.retail_price || '',
              b2b_price: p.b2b_price || '',
              category_id: p.category_id || '',
              brand_id: p.brand_id || '',
              is_active: p.is_active ?? true,
            });
            setCurrentMedia(p.media || []);
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
      if (formData.name_en) data.append('name[en]', formData.name_en);
      
      if (formData.description_ru) data.append('description[ru]', formData.description_ru);
      if (formData.description_kk) data.append('description[kk]', formData.description_kk);
      if (formData.description_en) data.append('description[en]', formData.description_en);
      
      if (formData.retail_price) data.append('retail_price', formData.retail_price);
      if (formData.b2b_price) data.append('b2b_price', formData.b2b_price);
      if (formData.category_id) data.append('category_id', formData.category_id);
      if (formData.brand_id) data.append('brand_id', formData.brand_id);
      
      data.append('is_active', formData.is_active ? '1' : '0');
      
      images.forEach((img) => {
        data.append('images[]', img);
      });
      
      let url = `/admin/products`;
      if (!isCreate) {
        url += `/${id}`;
        data.append('_method', 'PUT'); // Laravel requirement for multipart PUT
      }
      
      const res = await api.post(url, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      if (res.status === 200 || res.status === 201) {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 text-gray-900">
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
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Name (RU) <span className="text-red-500">*</span></label>
                <input 
                  required
                  name="name_ru"
                  value={formData.name_ru}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter product name in Russian"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Name (KK)</label>
                <input 
                  name="name_kk"
                  value={formData.name_kk}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter product name in Kazakh"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Name (EN)</label>
                <input 
                  name="name_en"
                  value={formData.name_en}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter product name in English"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select 
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                >
                  <option value="">Select a category</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name?.ru || c.id}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2 flex items-center pt-6">
                <label className="relative flex items-center cursor-pointer gap-3">
                  <input 
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="text-sm font-medium text-gray-700">Active (Visible in catalog)</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Retail Price (₸)</label>
                <input 
                  type="number"
                  name="retail_price"
                  value={formData.retail_price}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">B2B Price (₸)</label>
                <input 
                  type="number"
                  name="b2b_price"
                  value={formData.b2b_price}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="0"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Description (RU)</label>
                <textarea 
                  name="description_ru"
                  value={formData.description_ru}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                  placeholder="Product description in Russian"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Description (KK)</label>
                <textarea 
                  name="description_kk"
                  value={formData.description_kk}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                  placeholder="Product description in Kazakh"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Description (EN)</label>
                <textarea 
                  name="description_en"
                  value={formData.description_en}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                  placeholder="Product description in English"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
            <h2 className="text-lg font-semibold border-b pb-2">Media & Images</h2>
            
            {currentMedia.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Current Images</label>
                <div className="flex gap-4 flex-wrap">
                  {currentMedia.map((m) => (
                    <div key={m.id} className="relative w-24 h-24 rounded-lg border border-gray-200 overflow-hidden group">
                      <img src={m.original_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Uploading new images will replace these.</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Upload New Images</label>
              <input 
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setImages(Array.from(e.target.files));
                  }
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all border border-gray-200 rounded-lg p-1 bg-gray-50 cursor-pointer"
              />
              {images.length > 0 && (
                <p className="text-sm text-green-600 mt-2">{images.length} file(s) selected.</p>
              )}
            </div>
          </div>

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
      </div>
    </div>
  );
}
