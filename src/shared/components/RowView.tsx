import type { ReactNode } from "react";
import { AOS } from "./AOS";

interface RowViewProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderPrimary: (item: T) => ReactNode;
  renderSecondary?: (item: T) => ReactNode;
}

export function RowView<T>({ items, getKey, renderPrimary, renderSecondary }: RowViewProps<T>) {
  return (
    <AOS animation="fade-in">
      <div className="space-y-2 rounded-[28px] border border-[#EAEAEA] bg-white p-4 shadow-[0_18px_42px_rgba(16,26,36,0.07)]">
        {items.map((item) => (
          <div key={getKey(item)} className="flex items-center justify-between rounded-xl bg-[#F9F9F8] px-5 py-4 text-sm text-[#333333] transition-colors duration-150 hover:bg-accent/10">
            <div className="font-bold text-[#1A1A1A]">{renderPrimary(item)}</div>
            {renderSecondary ? <div className="text-[#787774]">{renderSecondary(item)}</div> : null}
          </div>
        ))}
      </div>
    </AOS>
  );
}
