'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [nameRu, setNameRu] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [retailPrice, setRetailPrice] = useState('');
  const [existingImages, setExistingImages] = useState<any[]>([]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/admin/products/${params.id}`);
        if (res.ok) {
          const json = await res.json();
          const p = json.data;
          setProduct(p);
          setNameRu(p.name?.ru || '');
          setIsActive(p.is_active);
          setRetailPrice(p.retail_price || '');
          setExistingImages(p.media || []);
        }
      } catch (error) {
        console.error('Failed to fetch product', error);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchProduct();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create FormData to handle image uploads
      const formData = new FormData();
      formData.append('_method', 'PUT'); // Laravel spoofing for PUT with files
      
      // Send translations as array
      formData.append('name[ru]', nameRu);
      
      formData.append('is_active', isActive ? '1' : '0');
      if (retailPrice) formData.append('retail_price', retailPrice.toString());
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput && fileInput.files) {
        for (let i = 0; i < fileInput.files.length; i++) {
          formData.append('images[]', fileInput.files[i]);
        }
      }

      const res = await fetch(`http://localhost:8000/api/admin/products/${params.id}`, {
        method: 'POST', // Use POST with _method=PUT
        body: formData,
        headers: {
          'Accept': 'application/json',
          // 'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        alert('Product updated successfully!');
        router.push('/products');
      } else {
        const errorData = await res.json();
        alert('Validation failed: ' + JSON.stringify(errorData.errors));
      }
    } catch (error) {
      console.error('Failed to update product', error);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!product) return <div className="p-6">Product not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Product #{product.id}</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded shadow text-black">
        <div>
          <label className="block text-sm font-medium mb-1">Name (RU)</label>
          <input 
            type="text" 
            value={nameRu}
            onChange={(e) => setNameRu(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Retail Price (tiyn)</label>
          <input 
            type="number" 
            value={retailPrice}
            onChange={(e) => setRetailPrice(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="isActive" className="text-sm font-medium">Is Active</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Images</label>
          {existingImages.length > 0 && (
            <div className="flex gap-2 mb-2">
              {existingImages.map(img => (
                <img key={img.id} src={img.original_url} alt="" className="w-20 h-20 object-cover rounded border" />
              ))}
            </div>
          )}
          <input 
            type="file" 
            multiple 
            accept="image/*"
            className="w-full border p-2 rounded"
          />
          <p className="text-xs text-gray-500 mt-1">Uploading new images will replace existing ones.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => router.push('/products')} className="px-4 py-2 border rounded hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
