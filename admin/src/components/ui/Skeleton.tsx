/** Заглушка на время загрузки. Размер задаёт вызывающий через `className`. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-zinc-200/70 ${className}`} />;
}
