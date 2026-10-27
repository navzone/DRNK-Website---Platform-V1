"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatDateTime, formatINR } from "@/lib/format";
import { btn, btnGhost, Panel } from "@/components/ui";

type Row = Record<string, unknown> & { id: string };
const TABS = [
  { key: "venues", label: "Venues", entity: "venue" },
  { key: "events", label: "Events", entity: "event" },
  { key: "talents", label: "Talent", entity: "talent" },
  { key: "applications", label: "Merchant applications", entity: "merchant_application" },
  { key: "users", label: "Users" },
  { key: "bookings", label: "Bookings" },
  { key: "support", label: "Support" },
  { key: "data-requests", label: "Data requests" },
  { key: "audit", label: "Audit log" },
] as const;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function AdminConsole() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await api<{ items: Row[] }>(`/api/admin/lists/${tab.key}`);
      if (!alive) return;
      if (res.ok) { setRows(res.data.items); setError(null); } else setError(res.message);
    })();
    return () => { alive = false; };
  }, [tab, reload]);

  async function act(path: string, body: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setNote(null);
    const res = await api(path, { body });
    if (res.ok) { setNote("Done."); setReload((k) => k + 1); } else setError(res.message);
  }

  return (
    <div>
      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t.key} role="tab" aria-selected={t.key === tab.key} onClick={() => { setTab(t); setRows(null); setError(null); setNote(null); }} className={t.key === tab.key ? btn : btnGhost}>{t.label}</button>)}
      </div>
      {note && <p role="status" className="mt-4 text-sm text-gold">{note}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-rose">{error} <button onClick={() => { setError(null); setReload((k) => k + 1); }} className="underline">Retry</button></p>}
      {!rows && !error && <p className="mt-6 text-mist" aria-busy="true">Loading</p>}
      {rows && rows.length === 0 && <Panel className="mt-6 text-mist">Nothing here yet.</Panel>}
      {rows && rows.length > 0 && (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id}><Panel>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  {"entity" in tab && (
                    <>
                      <p className="font-display text-lg">{str(r.name ?? r.title ?? r.stageName ?? r.businessName)}</p>
                      <p className="text-sm text-mist">Status: <span className="text-gold">{str(r.status)}</span>{r.neighbourhood ? `, ${str(r.neighbourhood)}` : ""}</p>
                    </>
                  )}
                  {tab.key === "users" && <><p className="font-display text-lg">{str(r.displayName) || "Unnamed"}</p><p className="text-sm text-mist">{str(r.phoneE164)}, role: <span className="text-gold">{str(r.role)}</span></p></>}
                  {tab.key === "bookings" && <><p className="font-display text-lg">{str(r.ref)}</p><p className="text-sm text-mist">{str(r.status).replace("_", " ")}, {formatINR(Number(r.totalPaise))}, {formatDateTime(str(r.createdAt))}</p></>}
                  {(tab.key === "support") && <><p className="font-display text-lg">{str(r.subject)}</p><p className="text-sm text-mist">{str(r.body)}</p><p className="text-sm text-gold">{str(r.status)}</p></>}
                  {tab.key === "data-requests" && <><p className="font-display text-lg">{str(r.kind) === "delete" ? "Account deletion" : "Data copy"}</p><p className="text-sm text-gold">{str(r.status)}</p></>}
                  {tab.key === "audit" && <><p className="font-display text-lg">{str(r.action)}</p><p className="text-sm text-mist">{formatDateTime(str(r.createdAt))}, {str(r.entityType)} {str(r.entityId)}</p></>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {"entity" in tab && r.status !== "approved" && <button className={btn} onClick={() => act("/api/admin/approvals", { entity: tab.entity, id: r.id, status: "approved" })}>Approve</button>}
                  {"entity" in tab && r.status === "pending" && <button className={btnGhost} onClick={() => act("/api/admin/approvals", { entity: tab.entity, id: r.id, status: "rejected" })}>Reject</button>}
                  {"entity" in tab && r.status === "approved" && tab.key !== "applications" && <button className={btnGhost} onClick={() => act("/api/admin/approvals", { entity: tab.entity, id: r.id, status: "suspended" }, "Suspend this listing? It will disappear from public pages.")}>Suspend</button>}
                  {tab.key === "users" && (
                    <>
                      <select aria-label="Role" defaultValue={str(r.role)} onChange={(e) => act(`/api/admin/users/${r.id}/role`, { role: e.target.value }, `Change role to ${e.target.value}? The user will be logged out.`)} className="rounded-lg border border-snow/20 bg-ink px-3 py-2">
                        {["customer", "merchant", "host", "talent", "admin"].map((x) => <option key={x}>{x}</option>)}
                      </select>
                      <select aria-label="Tier" defaultValue="" onChange={(e) => e.target.value && act(`/api/admin/users/${r.id}/tier`, { tier: e.target.value })} className="rounded-lg border border-snow/20 bg-ink px-3 py-2">
                        <option value="">Assign tier</option>{["silver", "gold", "black"].map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </>
                  )}
                  {(tab.key === "support" || tab.key === "data-requests") && ["in_progress", "resolved", "rejected"].map((s) => <button key={s} className={btnGhost} onClick={() => act(`/api/admin/${tab.key === "support" ? "support" : "data-requests"}/${r.id}/status`, { status: s })}>{s.replace("_", " ")}</button>)}
                </div>
              </div>
            </Panel></li>
          ))}
        </ul>
      )}
    </div>
  );
}
