'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { allowedTransitions, statusBadge, statusLabel, type OrderStatus } from '@/components/orders/orderStatus';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/admin/orders/${id}`);
        const o = res.data.data;
        setOrder(o);
        setSelectedStatus(o.status);
      } catch (err) {
        console.error('Failed to fetch order', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      const res = await api.patch(`/admin/orders/${id}`, { status: selectedStatus });
      setOrder(res.data.data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Не удалось сохранить.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent mb-3" />
          <p>Загрузка заказа...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">Заказ не найден</p>
          <Link href="/orders" className="mt-4 inline-block text-blue-600 hover:underline text-sm">← К списку заказов</Link>
        </div>
      </div>
    );
  }

  const deliveryAddress = order.address
    ? [order.address.city, order.address.street, order.address.building, order.address.apartment].filter(Boolean).join(', ')
    : [order.delivery_city, order.delivery_street, order.delivery_building, order.delivery_apartment].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
            </svg>
            К списку заказов
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Заказ #{order.id}
              {order.number && <span className="ml-2 text-lg font-normal text-gray-400">({order.number})</span>}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {order.created_at ? new Date(order.created_at).toLocaleString('ru-KZ') : '—'}
              {order.type === 'reservation' && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">Бронирование</span>
              )}
            </p>
          </div>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${statusBadge(order.status)}`}>
            {statusLabel(order.status)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: items */}
          <div className="lg:col-span-2 space-y-6">

            {/* Order items */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-base">Состав заказа</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items && order.items.length > 0 ? order.items.map((item: any) => {
                  const img = item.product?.media?.[0]?.original_url;
                  return (
                    <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                      {img ? (
                        <img src={img} alt={item.name} className="w-14 h-14 object-cover rounded-lg border border-gray-100 shrink-0" />
                      ) : (
                        <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-gray-300 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 line-clamp-1">{item.name || item.product?.name?.ru || '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.quantity} × ₸{Number(item.price).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 shrink-0">
                        ₸{(Number(item.price) * Number(item.quantity)).toLocaleString()}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="px-6 py-8 text-center text-gray-400 text-sm">Позиции не найдены</div>
                )}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium">Итого</span>
                <span className="text-lg font-bold text-gray-900">₸{Number(order.total).toLocaleString()}</span>
              </div>
            </div>

            {/* Delivery info */}
            {(order.delivery_method || deliveryAddress) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 text-base mb-4">Доставка</h2>
                <dl className="space-y-2 text-sm">
                  {order.delivery_method && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-36 shrink-0">Способ:</dt>
                      <dd className="text-gray-900">{order.delivery_method === 'pickup' ? 'Самовывоз' : 'Доставка'}</dd>
                    </div>
                  )}
                  {deliveryAddress && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-36 shrink-0">Адрес:</dt>
                      <dd className="text-gray-900">{deliveryAddress}</dd>
                    </div>
                  )}
                  {order.delivery_comment && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-36 shrink-0">Комментарий:</dt>
                      <dd className="text-gray-900">{order.delivery_comment}</dd>
                    </div>
                  )}
                  {order.delivery_cost != null && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-36 shrink-0">Стоимость:</dt>
                      <dd className="text-gray-900">₸{Number(order.delivery_cost).toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Client */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 text-base mb-4">Клиент</h2>
              {order.user ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-gray-500 w-20 shrink-0">Имя:</dt>
                    <dd className="text-gray-900">{order.user.name || '—'}</dd>
                  </div>
                  {order.user.phone && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-20 shrink-0">Телефон:</dt>
                      <dd className="text-gray-900">{order.user.phone}</dd>
                    </div>
                  )}
                  {order.user.email && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-20 shrink-0">E-mail:</dt>
                      <dd className="text-gray-900 break-all">{order.user.email}</dd>
                    </div>
                  )}
                  {order.user.company_name && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-20 shrink-0">Компания:</dt>
                      <dd className="text-gray-900">{order.user.company_name}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-400 italic">Гостевой заказ</p>
              )}
              {order.contact_email && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                  <span className="text-gray-500">Контактный e-mail: </span>
                  <span className="text-gray-900">{order.contact_email}</span>
                </div>
              )}
              {order.comment && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                  <p className="text-gray-500 mb-1">Комментарий к заказу:</p>
                  <p className="text-gray-900">{order.comment}</p>
                </div>
              )}
            </div>

            {/* Change status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-900 text-base mb-4">Статус заказа</h2>
              {allowedTransitions(order.status as OrderStatus).length === 0 ? (
                <p className="text-sm text-zinc-500">Статус финальный — изменить нельзя.</p>
              ) : (
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-3"
                >
                  {[order.status as OrderStatus, ...allowedTransitions(order.status as OrderStatus)].map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
              )}

              {saveError && (
                <p className="text-red-600 text-xs mb-3">{saveError}</p>
              )}
              {saveSuccess && (
                <p className="text-green-600 text-xs mb-3">✓ Статус обновлён</p>
              )}

              {allowedTransitions(order.status as OrderStatus).length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedStatus === order.status}
                  className="w-full inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white shadow hover:bg-blue-700 h-10 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2" />
                      Сохранение...
                    </>
                  ) : 'Сохранить статус'}
                </button>
              )}
            </div>

            {/* Payment */}
            {(order.payment_method || order.payment_status) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 text-base mb-4">Оплата</h2>
                <dl className="space-y-2 text-sm">
                  {order.payment_method && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-24 shrink-0">Способ:</dt>
                      <dd className="text-gray-900">{order.payment_method}</dd>
                    </div>
                  )}
                  {order.payment_status && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-24 shrink-0">Статус:</dt>
                      <dd className="text-gray-900">{order.payment_status}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
