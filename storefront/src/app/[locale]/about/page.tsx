import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiGet, ApiError } from "@/lib/api";
import type { ContentPage } from "@/lib/types";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const SLUG = "about";

async function fetchPage(locale: string): Promise<ContentPage | null> {
  try {
    const response = await apiGet<{ data: ContentPage }>(`/public/pages/${SLUG}`, {
      locale,
      revalidate: 600,
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const page = await fetchPage(locale);

  if (!page) {
    return { title: "О нас — Paradise" };
  }

  return {
    title: page.seo_title ?? page.title,
    description: page.seo_description ?? undefined,
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const page = await fetchPage(locale);

  if (!page) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-[720px]">
      <Breadcrumbs items={[{ label: page.title }]} />
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl lg:text-[34px] leading-tight">
        {page.title}
      </h1>
      <div
        className="text-ink [&>*:first-child]:mt-0 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:no-underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-ink [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_li]:leading-relaxed [&_li]:text-ink [&_strong]:font-semibold [&_img]:my-6 [&_img]:max-w-full [&_img]:rounded-2xl"
        dangerouslySetInnerHTML={{ __html: page.body ?? "" }}
      />
    </article>
  );
}
