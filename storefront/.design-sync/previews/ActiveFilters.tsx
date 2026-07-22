import { ActiveFilters } from "@/components/ActiveFilters";

export function SingleFilter() {
  return (
    <div className="max-w-2xl">
      <ActiveFilters searchParams={{ q: "диван" }} pathname="/catalog/divany" />
    </div>
  );
}

export function MultipleFilters() {
  return (
    <div className="max-w-2xl">
      <ActiveFilters
        searchParams={{
          brand: "ambianta",
          price_min: "150000",
          price_max: "500000",
          in_stock: "1",
          q: "диван",
        }}
        pathname="/catalog/divany"
      />
    </div>
  );
}

export function AttributeFilter() {
  return (
    <div className="max-w-2xl">
      <ActiveFilters
        searchParams={{
          "attr[color]": "Серый",
          in_stock: "1",
        }}
        pathname="/catalog/divany"
      />
    </div>
  );
}
