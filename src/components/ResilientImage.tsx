"use client";

import { useState } from "react";

/**
 * Photo that falls back to a plain tinted tile with the name's initials if the image fails to load
 * (blocked network, removed upstream photo). Decorative by default: pass `alt` when the photo carries meaning.
 */
export function ResilientImage({ src, alt = "", label, className = "", fallbackClass = "items-end p-4 text-5xl", priority = false }: {
  src: string;
  alt?: string;
  /** Text used to build the fallback initials. */
  label: string;
  className?: string;
  /** Layout and size classes for the fallback tile's initials. */
  fallbackClass?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const initials = label.replace(/\s*\[.*\]$/, "").split(" ").slice(0, 2).map((w) => w[0]).join("");
    return (
      <div className={`flex bg-gradient-to-br from-panel-hi to-ink ${fallbackClass} ${className}`} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
        <span className="font-display font-extrabold text-snow/85">{initials}</span>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-panel-hi ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote stock photos; failure handled by the fallback above */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        // The error can fire before hydration attaches onError (server-rendered <img>), so check on mount too.
        ref={(el) => { if (el && el.complete && el.naturalWidth === 0) setFailed(true); }}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
    </div>
  );
}
