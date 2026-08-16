"use client";

import { useSettings } from "@/hooks/use-settings";

export function CurrencyDisplay({
  amount,
  showSign = false,
  className,
}: {
  amount: number;
  showSign?: boolean;
  className?: string;
}) {
  const { settings } = useSettings();
  const symbol = settings?.currencySymbol || "Rs";
  const sign = showSign && amount > 0 ? "+" : amount < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return (
    <span className={className}>
      {sign}
      {symbol} {formatted}
    </span>
  );
}
