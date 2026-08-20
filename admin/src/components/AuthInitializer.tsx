'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuthStore();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/auth/me', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        
        if (res.ok) {
          const userData = await res.json();
          setUser(userData.data || userData);
        } else {
          setUser(null);
        }
      } catch (e) {
        setUser(null);
      }
    };
    
    fetchUser();
  }, [setUser]);

  return <>{children}</>;
}
