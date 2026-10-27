/** Builds a query string from defined values only. */
export function qs(params: Record<string, string | number | undefined | null | false>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== false && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Only same-site relative paths are accepted as post-login redirects (prevents open redirects). */
export function safeNext(next: string | undefined | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/account";
}
