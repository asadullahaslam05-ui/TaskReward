"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * VisuallyHidden — renders content that is invisible to sighted users but
 * remains available to assistive technologies (screen readers).
 *
 * Use this to provide required accessible names (e.g. DialogTitle,
 * SheetTitle) when the UI design intentionally does not show a visible
 * title.
 *
 * This is the accessible alternative to `display: none` /
 * `visibility: hidden`, which would remove the element from the
 * accessibility tree as well.
 */
function VisuallyHidden({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="visually-hidden"
      className={cn(
        "absolute overflow-hidden clip-rect-0 size-1px -m-px p-0 border-0 whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
}

export { VisuallyHidden }
