import type { ReactNode } from "react";
import { AOS } from "./AOS";

interface GridViewProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

export function GridView<T>({ items, getKey, renderItem }: GridViewProps<T>) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <AOS key={getKey(item)} animation="fade-up" delay={Math.min(index * 100, 300)}>
          <article className="rounded-xl border border-[#EAEAEA] bg-white p-5 shadow-[0_18px_42px_rgba(16,26,36,0.07)] transition duration-200 hover:shadow-[0_22px_48px_rgba(16,26,36,0.10)]">
            {renderItem(item)}
          </article>
        </AOS>
      ))}
    </div>
  );
}
