import Link from 'next/link';

/**
 * Warns that the database has no active warehouse.
 *
 * Without one StoreResolver returns null and everything downstream fails
 * quietly: the catalog reports zero on hand and checkout 404s. A fresh install
 * gets a warehouse from DefaultStoreSeeder, but nothing stops someone
 * deactivating it — the fix lives on /stores, hence the link.
 *
 * `hasActiveStore` is null while the flag is still unknown (request in flight
 * or failed); the banner stays hidden then, so it never flashes on load.
 */
export default function NoActiveStoreWarning({ hasActiveStore }: { hasActiveStore: boolean | null }) {
  if (hasActiveStore !== false) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-sm">
        <span className="font-semibold">Нет ни одного активного склада.</span>{' '}
        Остатки не считаются, каталог показывает нули, а оформление заказа падает с ошибкой.
        Создайте склад или включите существующий.
      </div>
      <Link
        href="/stores"
        className="shrink-0 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Настроить склады →
      </Link>
    </div>
  );
}
