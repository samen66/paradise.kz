import { B2BCatalogView } from "@/components/b2b/B2BCatalogView";
import { useB2bAuth } from "@/stores/useB2bAuth";
import { sampleProducts, sampleFacets } from "../support/sample-data";

// B2BCatalogView fetches its own data on mount (no data props) and requires
// a signed-in B2B session even to start — same "compose around the fetch"
// technique as FavoriteButton: seed the real useB2bAuth store, then stub
// window.fetch to answer only the two endpoints this component calls
// (/products, /public/facets) with realistic JSON, falling through to the
// real fetch for anything else. This drives the REAL component through its
// REAL success path — the full grid, filters, sort, pagination — which is
// far more useful to compose with than the unreachable-backend error state.
function seedB2bSession() {
  useB2bAuth.setState({
    token: "preview-b2b-session-token",
    user: { id: 900, name: "Данияр Ахметов", email: "b2b@example.kz", phone: "+7 701 999 88 77", type: "b2b", company_name: "ТОО Мебель Плюс", company_bin: "870512300123", is_approved: true },
  });
}

function stubCatalogFetch(products: typeof sampleProducts, total: number) {
  const realFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/public/facets")) {
      return new Response(JSON.stringify(sampleFacets), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/products")) {
      const body = { data: products, meta: { current_page: 1, last_page: Math.max(1, Math.ceil(total / 12)), per_page: 12, total } };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return realFetch(input, init);
  }) as typeof window.fetch;
}

export function Populated() {
  seedB2bSession();
  stubCatalogFetch(sampleProducts, 42);
  return <B2BCatalogView title="Каталог для партнёров" seoDescription="Оптовые цены при регистрации по договору поставки." />;
}

export function Empty() {
  seedB2bSession();
  stubCatalogFetch([], 0);
  return <B2BCatalogView title="Офисная мебель" />;
}
