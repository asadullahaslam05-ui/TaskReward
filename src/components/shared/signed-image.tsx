"use client";

import { useEffect, useRef, useState } from "react";
import { getSignedUrl } from "@/lib/api-client/client";
import { Loader2, ImageOff } from "lucide-react";

interface SignedImageProps {
  /** Storage path of the private object, e.g. "uuid/payment_123_abc.jpg". */
  path: string;
  /** Storage bucket, e.g. "payment-proofs". */
  bucket: string;
  alt: string;
  className?: string;
  /** Optional fallback element while loading or on error. */
  fallback?: React.ReactNode;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; url: string };

/**
 * Renders a private Supabase Storage object by fetching a short-lived
 * signed URL server-side (which enforces ownership / admin authorization).
 *
 * The signed URL is never persisted — it is kept only in component state
 * for the current view session and expires after ~10 minutes.
 */
export function SignedImage({
  path,
  bucket,
  alt,
  className,
  fallback,
}: SignedImageProps) {
  const hasTarget = !!path && !!bucket;
  const [state, setState] = useState<State>(
    hasTarget ? { status: "loading" } : { status: "error" }
  );
  const reqId = useRef(0);

  useEffect(() => {
    if (!hasTarget) {
      return;
    }
    // Use a request id so a late response from a previous path/bucket
    // doesn't overwrite the current one.
    const id = ++reqId.current;
    getSignedUrl(path, bucket)
      .then((signedUrl) => {
        if (id === reqId.current) {
          setState({ status: "loaded", url: signedUrl });
        }
      })
      .catch(() => {
        if (id === reqId.current) {
          setState({ status: "error" });
        }
      });
    return () => {
      // Invalidate any in-flight response on path/bucket change.
      reqId.current++;
    };
  }, [path, bucket, hasTarget]);

  if (state.status === "loading") {
    return (
      fallback ?? (
        <div className="flex items-center justify-center h-full w-full text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )
    );
  }

  if (state.status === "error") {
    return (
      fallback ?? (
        <div className="flex flex-col items-center justify-center h-full w-full text-muted-foreground text-sm gap-2">
          <ImageOff className="h-8 w-8" />
          <span>Failed to load image</span>
        </div>
      )
    );
  }

  return <img src={state.url} alt={alt} className={className} />;
}
