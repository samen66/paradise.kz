"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Paginated, Order } from "@/lib/types";
import { useB2bAuth } from "@/stores/useB2bAuth";
import dayjs from "dayjs";
import "dayjs/locale/ru";

dayjs.locale("ru");

export default function B2BOrdersPage() {
  const { token } = useB2bAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchOrders = async () => {
      try {
        const response = await apiGet<Paginated<Order>>("/orders", { token });
        setOrders(response.data);
      } catch (error) {
        console.error("Failed to fetch B2B orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  const translateStatus = (status: string) => {
    const statuses: Record<string, string> = {
      new: "Новый",
      processing: "В обработке",
      shipped: "Отправлен",
      completed: "Выполнен",
      cancelled: "Отменён",
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-ink">Мои заказы</h1>
        <p className="text-muted mt-2">История ваших оптовых заказов.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-line overflow-hidden">
          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface border-b border-line">
                  <tr>
                    <th className="px-6 py-4 font-medium text-muted">Заказ</th>
                    <th className="px-6 py-4 font-medium text-muted">Дата</th>
                    <th className="px-6 py-4 font-medium text-muted">Сумма</th>
                    <th className="px-6 py-4 font-medium text-muted">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-ink">
                          № {order.number}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-ink">
                        {dayjs(order.created_at).format("DD MMMM YYYY, HH:mm")}
                      </td>
                      <td className="px-6 py-4 font-bold text-ink">
                        {order.total.toLocaleString("ru-RU")} ₸
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {translateStatus(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted">У вас пока нет заказов.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
