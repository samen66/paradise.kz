import { Pagination } from "@/components/Pagination";

export function FirstPage() {
  return (
    <Pagination
      meta={{ current_page: 1, last_page: 12, per_page: 24, total: 284 }}
      pathname="/catalog/gostinaya"
      searchParams={{}}
    />
  );
}

export function MiddlePage() {
  return (
    <Pagination
      meta={{ current_page: 6, last_page: 12, per_page: 24, total: 284 }}
      pathname="/catalog/gostinaya"
      searchParams={{ sort: "price_asc" }}
    />
  );
}

export function LastPage() {
  return (
    <Pagination
      meta={{ current_page: 12, last_page: 12, per_page: 24, total: 284 }}
      pathname="/catalog/gostinaya"
      searchParams={{}}
    />
  );
}
