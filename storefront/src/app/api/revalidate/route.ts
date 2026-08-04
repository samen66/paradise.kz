import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * On-demand cache revalidation endpoint.
 *
 * Called by the Laravel backend (ProductObserver → RevalidateStorefrontCacheJob)
 * whenever product data changes in the admin panel. Invalidates all fetch()
 * cache entries tagged with the given tag so the next visitor gets fresh data.
 *
 * POST /api/revalidate  { tag: "products", secret: "..." }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { tag, secret } = body as { tag?: string; secret?: string };

  const expectedSecret = process.env.REVALIDATION_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!tag || typeof tag !== "string") {
    return NextResponse.json({ error: "Missing tag" }, { status: 400 });
  }

  revalidateTag(tag, { expire: 0 });

  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}
