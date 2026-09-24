/** Заглушка двух колонок, пока грузятся товар и справочники. */
export default function ProductFormSkeleton() {
  const block = 'animate-pulse rounded-xl bg-zinc-200/70';

  return (
    <div role="status" aria-busy="true" aria-label="Загрузка товара" className="space-y-4">
      <div className={`${block} h-8 w-64`} />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <div className={`${block} h-48`} />
          <div className={`${block} h-36`} />
          <div className={`${block} h-40`} />
        </div>
        <div className="space-y-4">
          <div className={`${block} h-28`} />
          <div className={`${block} h-36`} />
          <div className={`${block} h-32`} />
        </div>
      </div>
    </div>
  );
}
