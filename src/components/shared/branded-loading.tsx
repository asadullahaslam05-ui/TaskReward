import { cn } from "@/lib/utils";
import { Loader2, Inbox, AlertCircle, RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ----------------------------------------------------------------------------
 * PageLoader — full-screen branded loading on the navy gradient
 * ------------------------------------------------------------------------- */
export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-navy gap-6">
      <div className="motion-scale-in">
        <BrandLogo size="lg" variant="mark" />
      </div>
      <div className="flex items-center gap-3 text-brand-silver">
        <Loader2 className="h-4 w-4 animate-spin text-brand-gold" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * BrandedSpinner — inline spinner with gold accent
 * ------------------------------------------------------------------------- */
export function BrandedSpinner({
  size = "md",
  className,
  label,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const dim = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className={cn(dim, "animate-spin text-brand-gold")} />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </span>
  );
}

/* ----------------------------------------------------------------------------
 * SectionLoader — block-level loading for in-page sections
 * ------------------------------------------------------------------------- */
export function SectionLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand-gold" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * CardSkeleton — branded card placeholder with gold shimmer overlay
 * ------------------------------------------------------------------------- */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("relative overflow-hidden p-6", className)}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="pointer-events-none absolute inset-0 motion-shimmer" aria-hidden />
    </Card>
  );
}

/* ----------------------------------------------------------------------------
 * TableSkeleton — placeholder for tabular data with multiple rows
 * ------------------------------------------------------------------------- */
export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-8" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`r-${r}`}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} className="h-10" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * EmptyState — friendly empty-state message
 * ------------------------------------------------------------------------- */
export function EmptyState({
  title = "Nothing here yet",
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-4 text-center",
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center">
        <Icon className="h-6 w-6 text-brand-gold" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      ) : null}
      {action ?? null}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * ErrorState — error message with retry affordance
 * ------------------------------------------------------------------------- */
export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 px-4 text-center",
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <AlertCircle className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 gap-2">
          <RefreshCw className="h-4 w-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
