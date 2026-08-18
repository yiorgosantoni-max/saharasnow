import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "yiorgosantoni@gmail.com").toLowerCase();
const RELEASED = new Set(["completed-released", "released", "completed"]);
const PENDING = new Set(["checkout-pending", "paid", "in-progress", "delivered", "completed-pending"]);
const PAID_WITHDRAWAL = new Set(["paid", "paid-manually", "completed", "processed", "paid-out"]);

function amountCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // Older SaharaSnow records briefly stored dollar amounts in *Cents fields.
  // A fractional value such as 0.5 therefore means $0.50, not half a cent.
  if (n !== 0 && Math.abs(n) < 1) return Math.round(n * 100);
  return Math.round(n);
}

function firstAmount(...values: unknown[]) {
  for (const value of values) {
    const n = amountCents(value);
    if (n !== 0) return n;
  }
  return 0;
}

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as {toDate?:unknown}).toDate === "function") return (value as {toDate:()=>Date}).toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,jsonValue(v)]));
  return value;
}

type Item = Record<string, unknown> & { id: string };
async function recent(collection: string, limit = 100): Promise<Item[]> {
  const snap = await db.collection(collection).limit(limit).get();
  return snap.docs.map(doc => jsonValue({id: doc.id, ...doc.data()}) as Item);
}

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) return NextResponse.json({error:"Only the SaharaSnow administrator can access this dashboard."},{status:403});

    const [kyc, listings, withdrawals, orders, tickets, users, auditLogs, reports] = await Promise.all([
      recent("kyc"), recent("listings"), recent("withdrawals", 1000), recent("orders", 5000),
      recent("supportTickets", 500), recent("users", 1000), recent("auditLogs", 200), recent("contentReports", 200)
    ]);

    const earnings = new Map<string, any>();
    for (const u of users) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || String(u.name || u.displayName || "");
      earnings.set(u.id, {
        id: u.id, name, email: String(u.email || ""), mode: String(u.mode || u.accountMode || "BUYING"),
        totalEarningsCents: firstAmount(u.totalEarningsCents, u.releasedEarningsCents, u.earningsCents),
        pendingEarningsCents: firstAmount(u.pendingEarningsCents, u.pendingCents),
        availableBalanceCents: firstAmount(u.availableBalanceCents, u.availableCents, u.balanceCents, u.sellerBalanceCents),
        withdrawnCents: firstAmount(u.withdrawnCents)
      });
    }

    for (const order of orders) {
      const sellerId = String(order.sellerId || "");
      if (!sellerId) continue;
      if (!earnings.has(sellerId)) earnings.set(sellerId,{id:sellerId,name:"",email:"",mode:"SELLER",totalEarningsCents:0,pendingEarningsCents:0,availableBalanceCents:0,withdrawnCents:0});
      const row = earnings.get(sellerId);
      const status = String(order.status || "").toLowerCase();
      const gross = firstAmount(order.sellerNetCents, order.sellerEarningsCents, order.netCents, order.serviceCents, order.amountCents, order.totalCents);
      if (RELEASED.has(status)) row.totalEarningsCents += gross;
      else if (PENDING.has(status)) row.pendingEarningsCents += gross;
    }

    for (const withdrawal of withdrawals) {
      const sellerId = String(withdrawal.sellerId || withdrawal.userId || "");
      if (!sellerId) continue;
      if (!earnings.has(sellerId)) earnings.set(sellerId,{id:sellerId,name:"",email:"",mode:"SELLER",totalEarningsCents:0,pendingEarningsCents:0,availableBalanceCents:0,withdrawnCents:0});
      if (PAID_WITHDRAWAL.has(String(withdrawal.status || "").toLowerCase())) {
        earnings.get(sellerId).withdrawnCents += firstAmount(withdrawal.netCents, withdrawal.amountCents, withdrawal.grossCents);
      }
    }

    const normalizedEarnings = [...earnings.values()].map(row => ({
      ...row,
      mode: row.mode === "BUYING" && (row.totalEarningsCents > 0 || row.pendingEarningsCents > 0 || row.availableBalanceCents > 0 || row.withdrawnCents > 0) ? "SELLER" : row.mode,
      // Orders are the durable ledger. Do not allow an old zero profile field to hide released earnings.
      totalEarningsCents: Math.max(0, row.totalEarningsCents),
      pendingEarningsCents: Math.max(0, row.pendingEarningsCents),
      availableBalanceCents: Math.max(0, row.availableBalanceCents),
      withdrawnCents: Math.max(0, row.withdrawnCents)
    }));

    const visibleOrders = orders.filter(item => ["paid","in-progress","delivered","disputed","completed-released","released","completed","refunded"].includes(String(item.status)));
    return NextResponse.json({adminEmail:ADMIN_EMAIL,kyc,listings,withdrawals,orders:visibleOrders,tickets,users,earnings:normalizedEarnings,auditLogs,reports});
  } catch {
    return NextResponse.json({error:"Unable to load the admin dashboard."},{status:500});
  }
}
