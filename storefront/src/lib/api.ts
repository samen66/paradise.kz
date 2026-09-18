// Thin typed wrapper around the Laravel public API. Server components fetch
// through API_URL_INTERNAL (docker-network hostname); the browser falls back
// to NEXT_PUBLIC_API_URL.

const serverBase = process.env.API_URL_INTERNAL;
const publicBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

function baseUrl(): string {
  if (typeof window === "undefined" && serverBase) {
    return serverBase;
  }

  return publicBase;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ApiValidationError extends ApiError {
  constructor(
    public readonly errors: Record<string, string[]>,
    message: string,
  ) {
    super(422, message);
  }

  /** All human-readable messages, flattened. */
  get messages(): string[] {
    return Object.values(this.errors).flat();
  }
}

interface ApiOptions extends RequestInit {
  locale?: string;
  /** ISR revalidation window in seconds; false disables caching. */
  revalidate?: number | false;
  searchParams?: Record<string, string | number | boolean | undefined>;
  tags?: string[];
  requireB2bAuth?: boolean;
  /** Sanctum bearer token for account endpoints. */
  token?: string | null;
}

async function request<T>(method: string, path: string, body: unknown, options: ApiOptions): Promise<T> {
  const url = new URL(baseUrl().replace(/\/$/, "") + path);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.locale ? { "Accept-Language": options.locale } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(method === "GET"
      ? { next: { revalidate: options.revalidate ?? 300, ...(options.tags?.length ? { tags: options.tags } : {}) } }
      : { cache: "no-store" as const }),
  });

  if (response.status === 422) {
    const payload = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
    throw new ApiValidationError(payload.errors ?? {}, payload.message ?? "Validation failed");
  }

  if (!response.ok) {
    throw new ApiError(response.status, `API ${response.status} for ${url.pathname}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let dataText = await response.text();

  // Some writes answer 201 with no body (e.g. PUT /account/favorites/{id}).
  if (dataText === "") {
    return undefined as T;
  }

  // In local development, rewrite absolute storage URLs to relative paths
  // so that Next.js rewrites can proxy them to the nginx container.
  // This bypasses docker host-gateway port conflicts on Mac.
  if (publicBase && publicBase.includes("localhost")) {
    const publicHost = new URL(publicBase).origin;
    dataText = dataText.replaceAll(publicHost + "/storage", "/storage");
  }

  return JSON.parse(dataText) as T;
}

export async function apiGet<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export async function apiPost<T>(path: string, body: unknown, options: ApiOptions = {}): Promise<T> {
  return request<T>("POST", path, body, options);
}

export async function apiPatch<T>(path: string, body: unknown, options: ApiOptions = {}): Promise<T> {
  return request<T>("PATCH", path, body, options);
}

export async function apiPut<T>(path: string, body: unknown, options: ApiOptions = {}): Promise<T> {
  return request<T>("PUT", path, body, options);
}

export async function apiDelete<T>(path: string, options: ApiOptions = {}): Promise<T> {
  return request<T>("DELETE", path, undefined, options);
}
