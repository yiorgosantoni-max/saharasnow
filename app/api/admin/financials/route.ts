import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pendingWithdrawalStatuses = new Set(["pending", "pending-manual-payment", "processing"]);
const paidWithdrawalStatuses = new Set(["paid", "completed", "processed", "paid-out"]);
const releasedOrderStatuses = new Set(["completed-released", "released", "completed"]);

function cents(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n !== 0) return Math.round(n);
  }
  return 0;
}

async function assertAdmin(req: NextRequest) {
  const token = await userFromRequest(req);
  const email = String(token.email || "").toLowerCase();
  const allowed = String(process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").toLowerCase();
  if (!allowed || email !== allowed) throw new Error("FORBIDDEN");
  return token;
}

export async function GET(req: NextRequest) {
  try {
    await assertAdmin(req);
    const [users, orders, withdrawals] = await Promise.all([
      db.collection("users").limit(1000).get(),
      db.collection("orders").limit(5000).get(),
      db.collection("withdrawals").limit(2000).get(),
    ]);

    const sellers = new Map<string, any>();
    for (const d of users.docs) {
      const x = d.data() as Record<string, unknown>;
      const available = cents(x.availableBalanceCents, x.availableCents, x.balanceCents, x.sellerBalanceCents);
      const released = cents(x.totalEarningsCents, x.releasedEarningsCents, x.earningsCents);
      const pending = cents(x.pendingEarningsCents, x.pendingCents);
      sellers.set(d.id, {
        id: d.id,
        name: [x.firstName, x.lastName].filter(Boolean).join(" ") || String(x.name || x.displayName || ""),
        email: String(x.email || ""),
        mode: String(x.mode || "BUYING"),
        totalEarningsCents: released,
        pendingEarningsCents: pending,
        availableBalanceCents: available,
        releasedFromOrders: 0,
        pendingFromOrders: 0,
        paidWithdrawalsCents: 0,
        pendingWithdrawalsCents: 0,
      });
    }

    let grossCents = 0;
    let sellerEarningsCents = 0;
    let platformFeesCents = 0;
    for (const d of orders.docs) {
      const o = d.data() as Record<string, unknown>;
      const gross = cents(o.serviceCents, o.amountCents, o.totalCents);
      const net = cents(o.sellerNetCents, o.sellerEarningsCents, o.netCents);
      const fee = cents(o.platformFeeCents, o.feeCents);
      grossCents += gross;
      sellerEarningsCents += net;
      platformFeesCents += fee;
      const sellerId = String(o.sellerId || "");
      if (!sellerId) continue;
      if (!sellers.has(sellerId)) sellers.set(sellerId, { id:sellerId, name:"", email:"", mode:"SELLER", totalEarningsCents:0, pendingEarningsCents:0, availableBalanceCents:0, releasedFromOrders:0, pendingFromOrders:0, paidWithdrawalsCents:0, pendingWithdrawalsCents:0 });
      const seller = sellers.get(sellerId)!;
      const amount = net || Math.max(0, gross - fee);
      if (releasedOrderStatuses.has(String(o.status || "").toLowerCase())) seller.releasedFromOrders += amount;
      else if (["active", "in-progress", "pending", "completed-pending"].includes(String(o.status || "").toLowerCase())) seller.pendingFromOrders += amount;
    }

    let pendingWithdrawalsCents = 0;
    let paidWithdrawalsCents = 0;
    for (const d of withdrawals.docs) {
      const w = d.data() as Record<string, unknown>;
      const status = String(w.status || "").toLowerCase();
      const gross = cents(w.grossCents, w.amountCents, w.netCents);
      const net = cents(w.netCents, w.amountCents, w.grossCents);
      const sellerId = String(w.sellerId || w.userId || "");
      if (pendingWithdrawalStatuses.has(status)) pendingWithdrawalsCents += net;
      if (paidWithdrawalStatuses.has(status)) paidWithdrawalsCents += net;
      if (sellerId && sellers.has(sellerId)) {
        const seller = sellers.get(sellerId)!;
        if (pendingWithdrawalStatuses.has(status)) seller.pendingWithdrawalsCents += gross;
        if (paidWithdrawalStatuses.has(status)) seller.paidWithdrawalsCents += gross;
      }
    }

    const rows = [...sellers.values()].map((seller) => {
      // Keep the live balance stored on the seller profile as the source of truth.
      // Order totals are a fallback for older records that do not have the newer fields.
      const released = Math.max(seller.totalEarningsCents, seller.releasedFromOrders);
      const pending = Math.max(seller.pendingEarningsCents, seller.pendingFromOrders);
      const available = Math.max(0, seller.availableBalanceCents);
      return { ...seller, totalEarningsCents: released, pendingEarningsCents: pending, availableBalanceCents: available };
    }).filter((x) => x.mode === "SELLER" || x.totalEarningsCents > 0 || x.pendingEarningsCents > 0 || x.availableBalanceCents > 0)
      .sort((a,b) => b.availableBalanceCents - a.availableBalanceCents || b.totalEarningsCents - a.totalEarningsCents);

    return NextResponse.json({ grossCents, sellerEarningsCents, platformFeesCents, pendingWithdrawalsCents, paidWithdrawalsCents, sellers: rows });
  } catch (error) {
    const x = publicError(error);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
