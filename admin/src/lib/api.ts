import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;

      if (status === 401 && window.location.pathname !== '/login') {
        // Expired or revoked token: without this, tables just stay empty.
        useAuthStore.getState().logout();
        window.location.assign('/login');
      } else if (status === 403) {
        toast.error('Нет доступа');
      } else if (status === undefined || status >= 500) {
        toast.error('Ошибка сервера или сети — попробуйте ещё раз');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
