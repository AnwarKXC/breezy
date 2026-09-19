"use client";

import { Card } from "./Card";
import { AOS } from "./AOS";
import type { AnalyticsCard as AnalyticsCardType } from "../analytics/types";

interface AnalyticsGridProps {
  cards: AnalyticsCardType[];
  loading?: boolean;
  onCardClick?: (card: AnalyticsCardType) => void;
}

function getTrendIcon(trend?: "up" | "down" | "neutral") {
  if (trend === "up") return "up";
  if (trend === "down") return "down";
  return "flat";
}

function getTrendColor(trend?: "up" | "down" | "neutral", change?: number) {
  if (trend === "neutral" || change === 0) return "text-[#787774]";
  return trend === "down" ? "text-[#9F2F2D]" : "text-[#346538]";
}

export function AnalyticsGrid({ cards, loading, onCardClick }: AnalyticsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-xl bg-[#EAEAEA]" />
        ))}
      </div>
    );
  }

  if (!cards.length) {
    return <div className="py-8 text-center text-sm text-[#787774]">No analytics data available</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <AOS key={card.id} animation="fade-up" delay={Math.min(index * 100, 300)}>
          <div>
            <Card className="cursor-pointer" onClick={() => onCardClick?.(card)}>
              <p className="text-xs font-medium uppercase tracking-wide text-[#787774]">{card.title}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[#1A1A1A]">
                {card.suffix ? `${card.value}${card.suffix}` : card.value}
              </p>
              {card.change !== undefined && (
                <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${getTrendColor(card.trend, card.change)}`}>
                  <span>{getTrendIcon(card.trend)}</span>
                  <span>{Math.abs(card.change)}%</span>
                  <span className="text-[#787774]">compared to last week</span>
                </p>
              )}
            </Card>
          </div>
        </AOS>
      ))}
    </div>
  );
}
