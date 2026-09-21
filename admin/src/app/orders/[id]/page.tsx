'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatTenge } from '@/lib/money';
import { statusBadge, statusLabel, type OrderStatus } from '@/components/orders/orderStatus';
import OrderItemsCard from '@/components/orders/OrderItemsCard';
import OrderStatusCard from '@/components/orders/OrderStatusCard';
import { paymentMethodLabel, paymentStatusLabel } from '@/components/orders/orderPayment';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/admin/orders/${id}`);
        const o = res.data.data;
        setOrder(o);
      } catch (err) {
        console.error('Failed to fetch order', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

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
      <div className="max-w-6xl mx-auto space-y-6">

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

        <OrderStatusCard orderId={order.id} status={order.status as OrderStatus} onChanged={setOrder} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left column: items */}
          <div className="xl:col-span-2 space-y-6">

            <OrderItemsCard order={order} />

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
                      <dd className="text-gray-900">{formatTenge(Number(order.delivery_cost))}</dd>
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

            {/* Payment */}
            {(order.payment_method || order.payment_status) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 text-base mb-4">Оплата</h2>
                <dl className="space-y-2 text-sm">
                  {order.payment_method && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-24 shrink-0">Способ:</dt>
                      <dd className="text-gray-900">{paymentMethodLabel(order.payment_method)}</dd>
                    </div>
                  )}
                  {order.payment_status && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500 w-24 shrink-0">Статус:</dt>
                      <dd className="text-gray-900">{paymentStatusLabel(order.payment_status)}</dd>
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
