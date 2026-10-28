"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { remoteFallback } from "@/content/photo-url";

/** Photo carousel for venue and event pages: arrows, dots, swipe, arrow keys. Failed photos show a tinted tile. */
export function Gallery({ images, alt, label, className = "aspect-[16/10] sm:aspect-[21/9]", badge }: {
  images: string[];
  alt: string;
  label: string;
  className?: string;
  badge?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState<Record<number, true>>({});
  const [useRemote, setUseRemote] = useState<Record<number, true>>({});
  const startX = useRef<number | null>(null);
  const n = images.length;
  // Bundled copy first, then the original address, then a tile.
  const onBroken = (k: number) => {
    if (!useRemote[k] && remoteFallback(images[k] ?? "")) setUseRemote((u) => ({ ...u, [k]: true }));
    else setFailed((f) => (f[k] ? f : { ...f, [k]: true }));
  };
  const srcOf = (k: number) => (useRemote[k] ? remoteFallback(images[k] ?? "") ?? images[k] : images[k]);
  const go = (d: number) => setI((c) => (c + d + n) % n);
  const initials = label.replace(/\s*\[.*\]$/, "").split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-panel-hi ${className}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt} photos`}
      tabIndex={n > 1 ? 0 : undefined}
      onKeyDown={(e) => { if (n > 1 && e.key === "ArrowLeft") go(-1); if (n > 1 && e.key === "ArrowRight") go(1); }}
      onTouchStart={(e) => { startX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const x0 = startX.current; startX.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (n > 1 && x0 != null && x1 != null && Math.abs(x1 - x0) > 40) go(x1 < x0 ? 1 : -1);
      }}
    >
      {failed[i] ? (
        <div className="flex h-full w-full items-end bg-gradient-to-br from-panel-hi to-ink p-5" aria-hidden="true">
          <span className="font-display text-6xl font-extrabold text-snow/85">{initials}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- remote stock photos; failure handled by the tile above
        <img
          key={srcOf(i)}
          src={srcOf(i)}
          alt={`${alt}, photo ${i + 1} of ${n}`}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => onBroken(i)}
          // The error can fire before hydration attaches onError (server-rendered <img>), so check on mount too.
          ref={(el) => { if (el && el.complete && el.naturalWidth === 0) onBroken(i); }}
          className="h-full w-full object-cover"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      {badge && <div className="absolute left-3 top-3">{badge}</div>}
      {n > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo"
            className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition-opacity hover:bg-black/70 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo"
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition-opacity hover:bg-black/70 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {images.map((_, k) => (
              <button key={k} type="button" onClick={() => setI(k)} aria-label={`Show photo ${k + 1}`} aria-current={k === i}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-gold" : "w-1.5 bg-white/50 hover:bg-white/80"}`} />
            ))}
          </div>
          <span className="tag absolute right-3 top-3 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-white/85 backdrop-blur" aria-hidden="true">{i + 1}/{n}</span>
        </>
      )}
    </div>
  );
}
