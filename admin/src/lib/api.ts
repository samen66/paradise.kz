import axios from 'axios';

/** Filament back-office (goods receipts, warehouses) sits on the API host, outside /api. */
export const ERP_ADMIN_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api')
  .replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
