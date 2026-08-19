"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientAuth } from "@/lib/firebase-client";

type Payment = {
  id: string;
  orderNumber?: string;
  title?: string;
  amountCents?: number;
  totalCents?: number;
  buyerId?: string;
  sellerId?: string;
  txHash?: string;
  depositAddress?: string;
  network?: string;
  source?: "invoice" | "order";
  packageName?: string;
  paymentCurrency?: "USDT" | "USDC" | string;
  paymentMethod?: string;
  status?: string;
};

const amount = (p: Payment) => Number(p.amountCents ?? p.totalCents ?? 0);
const money = (p: Payment) => `${(amount(p) / 100).toFixed(2)} ${p.paymentCurrency || "USDT"}`;
const isPaidCryptoOrder = (p: Payment) => p.source === "order" && p.status === "paid";

export default function CryptoPaymentsPage() {
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    try {
      setError("");
      const user = getClientAuth().currentUser;
      if (!user) throw new Error("Sign in with your administrator account.");
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/crypto-payments", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load payments.");
      setItems(data.payments || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments.");
    }
  };

  useEffect(() => {
    const auth = getClientAuth();
    return auth.onAuthStateChanged((user) => { if (user) void load(); else setError("Sign in with your administrator account."); });
  }, []);

  const action = async (payment: Payment, kind: "confirm" | "reject" | "release") => {
    const promptText = kind === "reject" ? "Reason for rejection:" : kind === "release" ? `Release ${money(payment)} to the seller? Add an optional release note:` : "Optional admin note:";
    if (kind !== "reject" && !window.confirm(kind === "release" ? `Release ${money(payment)} to the seller? This will make it a counted order.` : `Confirm ${money(payment)}?`)) return;
    const note = window.prompt(promptText);
    if (note === null) return;
    try {
      setBusy(payment.id);
      const user = getClientAuth().currentUser;
      if (!user) throw new Error("Sign in first.");
      const token = await user.getIdToken(true);
      const response = await fetch("/api/admin/crypto-payments", { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ invoiceId: payment.id, action: kind, note, source: payment.source || "invoice" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally { setBusy(""); }
  };

  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 32 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 28 }}>
        <div><Link href="/admin">← Admin dashboard</Link><h1 style={{ margin: "12px 0 4px" }}>◈ Crypto payment confirmation & release</h1><p>Verify TRC20 USDT and BEP20 USDC payments, then explicitly release seller funds.</p></div>
        <button onClick={() => void load()}>Refresh</button>
      </header>
      {error && <p style={{ padding: 12, border: "1px solid #d33", borderRadius: 8 }}>{error}</p>}
      {items.length === 0 ? <p>No crypto payments are waiting for confirmation or release.</p> : <div style={{ display: "grid", gap: 16 }}>{items.map((payment) => (
        <article key={`${payment.source || "invoice"}-${payment.id}`} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div><h2 style={{ marginTop: 0 }}>{payment.source === "order" ? "Service order" : payment.orderNumber || payment.id}</h2><p><b>{payment.title || payment.packageName || "Service payment"}</b></p><p>Amount: <b>{money(payment)}</b></p><p>Network: {payment.network || "TRC20"}</p><p>Status: <b>{payment.status === "paid" ? "Payment confirmed — awaiting seller release" : "Payment submitted — awaiting confirmation"}</b></p></div>
            <div>{isPaidCryptoOrder(payment) ? <button disabled={busy === payment.id} onClick={() => void action(payment, "release")}>↗ Release to seller</button> : <><button disabled={busy === payment.id} onClick={() => void action(payment, "confirm")}>✓ Confirm payment</button><button disabled={busy === payment.id} onClick={() => void action(payment, "reject")} style={{ marginLeft: 8 }}>Reject</button></>}</div>
          </div>
          <div><b>Transaction hash</b><code style={{ display: "block", overflowWrap: "anywhere", padding: 10, background: "#f5f5f5", borderRadius: 8 }}>{payment.txHash || "—"}</code></div>
        </article>
      ))}</div>}
    </main>
  );
}
