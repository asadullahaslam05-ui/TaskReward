import Image from "next/image";
import { cn } from "@/lib/utils";

export type BrandLogoSize = "xs" | "sm" | "md" | "lg" | "xl";
export type BrandLogoVariant = "full" | "mark";

const SIZE_PX: Record<BrandLogoSize, number> = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
};

const SRC: Record<BrandLogoVariant, string> = {
  full: "/branding/taskreward-logo.png",
  mark: "/branding/taskreward-mark.png",
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  variant?: BrandLogoVariant;
  showName?: boolean;
  className?: string;
  priority?: boolean;
}

/**
 * TaskReward official brand logo.
 *
 * - `variant="full"` renders the full badge logo (wordmark + emblem).
 * - `variant="mark"` renders the compact circular emblem only.
 * - When `showName` is true, the site name is rendered next to the mark.
 *
 * Uses next/image with `object-contain` so the badge aspect ratio is preserved
 * at any size. `priority` is on by default because the logo is almost always
 * above the fold (sidebar / auth hero / landing header).
 */
export function BrandLogo({
  size = "md",
  variant = "full",
  showName = false,
  className,
  priority = true,
}: BrandLogoProps) {
  const px = SIZE_PX[size];

  if (showName) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Image
          src={SRC[variant]}
          alt="TaskReward logo"
          width={px}
          height={px}
          priority={priority}
          className="object-contain"
          style={{ width: px, height: px }}
        />
        <span className="font-bold tracking-tight">TaskReward</span>
      </div>
    );
  }

  return (
    <Image
      src={SRC[variant]}
      alt="TaskReward logo"
      width={px}
      height={px}
      priority={priority}
      className={cn("object-contain", className)}
      style={{ width: px, height: px }}
    />
  );
}
