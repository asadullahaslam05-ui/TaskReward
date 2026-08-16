"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS } from "@/lib/types";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  return (
    <Badge variant="outline" className={`${colorClass} border-0 font-medium ${className}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
