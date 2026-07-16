// Preview-only shim for next/image. The real component needs Next's
// image-optimization server (/_next/image) which doesn't exist for a static
// preview bundle; this renders a plain <img> from the given src instead.
import type { CSSProperties, ImgHTMLAttributes } from "react";

type ImgSrc = string | { src: string };

export default function Image({
  src,
  alt,
  fill,
  sizes: _sizes,
  priority: _priority,
  quality: _quality,
  loader: _loader,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  style,
  ...rest
}: {
  src: ImgSrc;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  loader?: unknown;
  placeholder?: string;
  blurDataURL?: string;
  style?: CSSProperties;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">) {
  const resolvedSrc = typeof src === "string" ? src : (src?.src ?? "");
  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
    : undefined;

  return <img src={resolvedSrc} alt={alt ?? ""} style={{ ...fillStyle, ...style }} {...rest} />;
}
