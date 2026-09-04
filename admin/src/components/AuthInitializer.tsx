'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser, logout } = useAuthStore();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          setUser(null);
          return;
        }

        const res = await api.get('/auth/me');
        setUser(res.data.user || res.data.data || res.data);
      } catch (e) {
        logout();
      }
    };
    
    fetchUser();
  }, [setUser, logout]);

  return <>{children}</>;
}
