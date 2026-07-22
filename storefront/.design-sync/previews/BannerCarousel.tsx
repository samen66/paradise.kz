import { BannerCarousel } from "@/components/BannerCarousel";
import { sampleBanners } from "../support/sample-data";

export function Multiple() {
  return (
    <div className="max-w-4xl bg-canvas p-4">
      <BannerCarousel banners={sampleBanners} />
    </div>
  );
}

export function Single() {
  return (
    <div className="max-w-4xl bg-canvas p-4">
      <BannerCarousel banners={[sampleBanners[0]]} />
    </div>
  );
}

export function Minimal() {
  return (
    <div className="max-w-4xl bg-canvas p-4">
      <BannerCarousel banners={[sampleBanners[2]]} />
    </div>
  );
}
