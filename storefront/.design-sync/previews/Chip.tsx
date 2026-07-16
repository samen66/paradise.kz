"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";

export function ActiveInactive() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Chip active={false}>Только в наличии</Chip>
      <Chip active>Только в наличии</Chip>
    </div>
  );
}

export function FilterRow() {
  const [selected, setSelected] = useState("divany");
  const options = [
    { slug: "divany", name: "Диваны" },
    { slug: "kresla", name: "Кресла" },
    { slug: "tumby-pod-tv", name: "Тумбы под ТВ" },
    { slug: "krovati", name: "Кровати" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <Chip key={o.slug} active={selected === o.slug} onClick={() => setSelected(o.slug)}>
          {o.name}
        </Chip>
      ))}
    </div>
  );
}

export function Interactive() {
  const [active, setActive] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Chip active={active} onClick={() => setActive((v) => !v)}>
        {active ? "Выбрано: Серый" : "Цвет: Серый"}
      </Chip>
    </div>
  );
}
