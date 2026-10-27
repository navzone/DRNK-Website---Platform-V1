"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; code?: string };

/** Same-origin JSON call. The browser attaches the HttpOnly session cookie and the Origin header automatically. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: opts.body ? { "content-type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: data?.error?.message ?? "Something went wrong. Try again.", code: data?.error?.code };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, message: "Can't reach DRNK. Check your connection and try again." };
  }
}
