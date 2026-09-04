'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { page: page.toString() };
      if (search) params['filter[search]'] = search;
      if (status) params['filter[is_approved]'] = status;

      const res = await api.get('/admin/users', { params });
      const json = res.data;
      setUsers(json.data || []);
      setTotalPages(json.meta?.last_page || 1);
      setTotal(json.meta?.total || 0);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const handleApprove = async (id: number) => {
    if (!confirm('Клиент получит доступ к оптовому каталогу и ценам. Одобрить?')) return;
    setApprovingId(id);
    try {
      await api.post(`/admin/users/${id}/approve`);
      alert('Клиент успешно одобрен!');
      fetchUsers();
    } catch (err: any) {
      alert('Ошибка при одобрении: ' + (err.response?.data?.message || err.message));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Клиенты (B2B)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Управление оптовыми клиентами.
            {total > 0 && <span className="ml-2 font-medium text-gray-700">{total} всего</span>}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder="Поиск по компании, БИН, email или телефону..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-full sm:w-52 px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          >
            <option value="">Все статусы</option>
            <option value="1">Одобренные</option>
            <option value="0">Ожидают</option>
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs font-semibold">
                  <th className="px-6 py-4">Компания / Имя</th>
                  <th className="px-6 py-4">Контакты</th>
                  <th className="px-6 py-4">БИН</th>
                  <th className="px-6 py-4">Статус</th>
                  <th className="px-6 py-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Клиенты не найдены.
                    </td>
                  </tr>
                ) : (
                  users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{user.company_name || '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{user.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{user.phone || '—'}</div>
                        <div className="text-gray-500 text-xs">{user.email || '—'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-700 font-medium">
                        {user.company_bin || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${user.is_approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                          {user.is_approved ? 'Одобрен' : 'Ожидает'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!user.is_approved && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            disabled={approvingId === user.id}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {approvingId === user.id ? 'Одобрение...' : 'Одобрить'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Страница <span className="font-medium text-gray-900">{page}</span> из <span className="font-medium text-gray-900">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Вперёд
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
