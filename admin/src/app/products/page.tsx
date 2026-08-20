'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);

  const fetchProducts = async () => {
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(search && { 'filter[search]': search }),
        ...(isActive && { 'filter[is_active]': isActive }),
      });
      const res = await fetch(`http://localhost:8000/api/admin/products?${query}`, {
        headers: {
          'Accept': 'application/json',
          // 'Authorization': `Bearer ${token}` // TODO: Add auth token
        }
      });
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search, isActive]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        fetchProducts();
      }
    } catch (error) {
      console.error('Failed to delete product', error);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Link href="/products/create" className="bg-blue-600 text-white px-4 py-2 rounded">
          Add Product
        </Link>
      </div>

      <div className="flex gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Search by name or code..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <select 
          value={isActive} 
          onChange={(e) => setIsActive(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">All Statuses</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-4">ID</th>
              <th className="p-4">Photo</th>
              <th className="p-4">Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Retail Price</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.id} className="border-b text-black">
                <td className="p-4">{p.id}</td>
                <td className="p-4">
                  {p.media && p.media.length > 0 ? (
                    <img src={p.media[0].original_url} alt="" className="w-12 h-12 object-cover rounded" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded"></div>
                  )}
                </td>
                <td className="p-4">{p.name?.ru || 'No name'}</td>
                <td className="p-4">{p.category?.name?.ru || '-'}</td>
                <td className="p-4">{p.retail_price}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 flex gap-2">
                  <Link href={`/products/${p.id}`} className="text-blue-600 hover:underline">Edit</Link>
                  <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
