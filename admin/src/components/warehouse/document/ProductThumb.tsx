/** Миниатюра товара 40 px; без фото — серый квадрат того же размера, чтобы строки не прыгали. */
export default function ProductThumb({ url }: { url: string | null | undefined }) {
  return (
    <span data-testid="product-thumb" className="inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-100">
      {/* Миниатюра с API уже нужного размера — оптимизация next/image здесь не нужна. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
    </span>
  );
}
