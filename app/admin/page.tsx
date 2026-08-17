"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./admin.css";

type Item = Record<string, unknown> & { id: string };
type Data = {
  adminEmail: string;
  kyc: Item[];
  listings: Item[];
  withdrawals: Item[];
  orders: Item[];
  tickets: Item[];
  users: Item[];
  earnings: Item[];
  auditLogs: Item[];
  reports: Item[];
};
type Tab = "kyc" | "listings" | "withdrawals" | "orders" | "tickets" | "users" | "earnings" | "reports" | "auditLogs";
type AuthUser = { getIdToken: (forceRefresh?: boolean) => Promise<string> };

const labels: Record<Tab, string> = {
  kyc: "KYC",
  listings: "Listings",
  withdrawals: "Withdrawals",
  orders: "Orders & disputes",
  tickets: "Support",
  users: "Users",
  earnings: "Earnings",
  reports: "Reports",
  auditLogs: "Audit log",
};

const resource: Partial<Record<Tab, string>> = {
  kyc: "kyc",
  listings: "listing",
  withdrawals: "withdrawal",
  orders: "order",
  tickets: "ticket",
  users: "user",
  reports: "report",
};

const actions: Partial<Record<Tab, { label: string; action: string; danger?: boolean }[]>> = {
  kyc: [
    { label: "Approve", action: "approve" },
    { label: "Request new documents", action: "reupload", danger: true },
    { label: "Reject", action: "reject", danger: true },
  ],
  listings: [
    { label: "Publish", action: "approve" },
    { label: "Reject", action: "reject", danger: true },
    { label: "Delete", action: "delete", danger: true },
  ],
  withdrawals: [
    { label: "Mark paid", action: "paid" },
    { label: "Reject & restore balance", action: "reject", danger: true },
  ],
  orders: [
    { label: "Release to seller", action: "release" },
    { label: "Mark refunded", action: "refund", danger: true },
    { label: "Delete", action: "delete", danger: true },
  ],
  tickets: [{ label: "Close ticket", action: "close" }],
  users: [
    { label: "Restore", action: "restore" },
    { label: "Suspend", action: "suspend", danger: true },
  ],
  reports: [{ label: "Delete report", action: "delete", danger: true }],
};

const emptyData = (): Data => ({
  adminEmail: "",
  kyc: [],
  listings: [],
  withdrawals: [],
  orders: [],
  tickets: [],
  users: [],
  earnings: [],
  auditLogs: [],
  reports: [],
});

const text = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return "—"; }
  }
  return String(value);
};

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `€${(n / 100).toFixed(2)}` : "€0.00";
};

export default function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("listings");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [search, setSearch] = useState("");

  const load = async (user: AuthUser) => {
    setError("");
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.text();
      let result: Partial<Data> & { error?: string } = {};
      try { result = body ? JSON.parse(body) : {}; }
      catch { throw new Error(`Admin service returned invalid data (${response.status}).`); }
      if (!response.ok) throw new Error(result.error || `Admin service returned ${response.status}.`);
      setData({
        adminEmail: String(result.adminEmail || ""),
        kyc: Array.isArray(result.kyc) ? result.kyc : [],
        listings: Array.isArray(result.listings) ? result.listings : [],
        withdrawals: Array.isArray(result.withdrawals) ? result.withdrawals : [],
        orders: Array.isArray(result.orders) ? result.orders : [],
        tickets: Array.isArray(result.tickets) ? result.tickets : [],
        users: Array.isArray(result.users) ? result.users : [],
        earnings: Array.isArray(result.earnings) ? result.earnings : [],
        auditLogs: Array.isArray(result.auditLogs) ? result.auditLogs : [],
        reports: Array.isArray(result.reports) ? result.reports : [],
      });
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Unable to load admin dashboard.");
    }
  };

  useEffect(() => {
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const [{ getClientAuth }, auth] = await Promise.all([
          import("@/lib/firebase-client"),
          import("firebase/auth"),
        ]);
        if (stopped) return;
        const clientAuth = getClientAuth();
        unsubscribe = auth.onAuthStateChanged(clientAuth, (user) => {
          if (stopped) return;
          if (user) {
            const safeUser: AuthUser = { getIdToken: (forceRefresh) => user.getIdToken(forceRefresh) };
            setAuthUser(safeUser);
            void load(safeUser);
          } else {
            setAuthUser(null);
            setData(null);
            setError("Sign in with your administrator account on the homepage first.");
          }
        });
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Unable to initialize administrator sign-in.");
      }
    })();
    return () => { stopped = true; unsubscribe?.(); };
  }, []);

  const rows = useMemo(() => {
    const list = data?.[tab] || [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
  }, [data, tab, search]);

  const act = async (item: Item, action: string) => {
    if (!authUser) { setError("Administrator authentication is not ready. Refresh and sign in again."); return; }
    if (action === "delete" && !window.confirm(`Delete ${text(item.title || item.orderNumber || item.id)} permanently?`)) return;
    const entered = window.prompt(action === "reupload" ? "Explain which newer or clearer documents the user must upload:" : "Optional admin note:");
    if (entered === null) return;
    if (action === "reupload" && !entered.trim()) { setError("Enter a reason for the new documents."); return; }
    setBusy(`${item.id}:${action}`);
    try {
      const token = await authUser.getIdToken(true);
      const response = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ resource: resource[tab], id: item.id, action, note: entered.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Admin action failed.");
      await load(authUser);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin action failed.");
    } finally {
      setBusy("");
    }
  };

  const logout = async () => {
    try {
      const { signOutUser } = await import("@/lib/firebase-client");
      await signOutUser();
      window.location.href = "/";
    } catch { setError("Unable to log out."); }
  };

  const earningsTotals = useMemo(() => {
    return rows.reduce((acc, item) => {
      acc.released += Number(item.totalReleasedCents ?? item.releasedCents ?? 0) || 0;
      acc.pending += Number(item.pendingCents ?? 0) || 0;
      acc.available += Number(item.availableCents ?? 0) || 0;
      return acc;
    }, { released: 0, pending: 0, available: 0 });
  }, [rows]);

  return (
    <main className="adminShell">
      <header className="adminHeader">
        <Link href="/" className="brand">saharasnow</Link>
        <div><b>Admin control centre</b><small>{data?.adminEmail || "Secure administrator access"}</small></div>
        <div className="adminHeaderActions"><button onClick={() => authUser && void load(authUser)}>Refresh</button><button className="adminLogout" onClick={logout}>Log out</button></div>
      </header>

      <section className="adminHero">
        <div><span>LIVE OPERATIONS</span><h1>Marketplace administration</h1><p>Manage marketplace operations, financials, users and trust controls.</p></div>
        <div className="adminStats">
          <b>{data?.kyc.length || 0}<small>KYC</small></b>
          <b>{data?.listings.length || 0}<small>Listings</small></b>
          <b>{data?.withdrawals.length || 0}<small>Withdrawals</small></b>
          <b>{data?.users.length || 0}<small>Users</small></b>
        </div>
      </section>

      {error && <div className="adminError" role="alert">{error}</div>}

      <nav className="adminTabs" aria-label="Admin sections">
        {(Object.keys(labels) as Tab[]).map((key) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); setSearch(""); }}>{labels[key]} <span>{data?.[key]?.length || 0}</span></button>)}
      </nav>

      <section className="adminPanel">
        <div className="adminPanelHead"><div><h2>{labels[tab]}</h2><p>{rows.length} record{rows.length === 1 ? "" : "s"}</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this section…" /></div>

        {tab === "earnings" && <div className="earningsSummary"><div><span>Released</span><strong>{money(earningsTotals.released)}</strong></div><div><span>Pending</span><strong>{money(earningsTotals.pending)}</strong></div><div><span>Available</span><strong>{money(earningsTotals.available)}</strong></div></div>}

        {rows.length === 0 ? <div className="adminEmpty">No records found.</div> : tab === "earnings" ? (
          <div className="adminTableWrap"><table className="adminTable"><thead><tr><th>User</th><th>Email</th><th>Released</th><th>Pending</th><th>Available</th><th>Withdrawn</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td>{text(item.displayName || item.name || item.userName || item.id)}</td><td>{text(item.email || item.userEmail)}</td><td>{money(item.totalReleasedCents ?? item.releasedCents)}</td><td>{money(item.pendingCents)}</td><td>{money(item.availableCents)}</td><td>{money(item.withdrawnCents)}</td></tr>)}</tbody></table></div>
        ) : (
          <div className="adminRows">{rows.map((item) => <article className="adminRow" key={item.id}><div className="adminRowMain"><strong>{text(item.title || item.name || item.subject || item.orderNumber || item.email || item.id)}</strong><small>{text(item.email || item.status || item.category || item.createdAt)}</small><p>{text(item.description || item.reason || item.message || item.note || "")}</p></div><div className="adminRowActions">{(actions[tab] || []).map((a) => <button key={a.action} disabled={busy === `${item.id}:${a.action}`} className={a.danger ? "danger" : ""} onClick={() => void act(item, a.action)}>{busy === `${item.id}:${a.action}` ? "Working…" : a.label}</button>)}</div></article>)}</div>
        )}
      </section>
    </main>
  );
}
