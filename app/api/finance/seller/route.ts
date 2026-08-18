import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paidStatuses = new Set(["paid", "completed", "processed", "paid-out"]);
const pendingStatuses = new Set(["pending", "pending-manual-payment", "processing"]);

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const profile = (await db.collection("users").doc(user.uid).get()).data() || {};
    const [orders, withdrawals] = await Promise.all([
      db.collection("orders").where("sellerId", "==", user.uid).limit(500).get(),
      db.collection("withdrawals").where("sellerId", "==", user.uid).limit(200).get()
    ]);

    const orderRows = orders.docs.map(d => ({ id: d.id, ...d.data() }));
    const releasedFromOrders = orderRows
      .filter((o: any) => String(o.status) === "completed-released")
      .reduce((n: number, o: any) => n + Math.max(0, Number(o.sellerNetCents || 0)), 0);
    const pendingFromOrders = orderRows
      .filter((o: any) => ["paid", "in-progress", "delivered", "disputed"].includes(String(o.status)))
      .reduce((n: number, o: any) => n + Math.max(0, Number(o.sellerNetCents || 0)), 0);

    const released = Math.max(Number(profile.totalEarningsCents || 0), releasedFromOrders);
    const pending = Math.max(Number(profile.pendingEarningsCents || 0), pendingFromOrders);
    const withdrawalRows = withdrawals.docs.map(d => ({ id: d.id, ...d.data() }));
    const withdrawn = withdrawalRows
      .filter((d: any) => paidStatuses.has(String(d.status)))
      .reduce((n: number, d: any) => n + Math.max(0, Number(d.grossCents ?? d.netCents ?? 0)), 0);
    const pendingWithdrawal = withdrawalRows
      .filter((d: any) => pendingStatuses.has(String(d.status)))
      .reduce((n: number, d: any) => n + Math.max(0, Number(d.grossCents || 0)), 0);

    // Old released orders may not have populated availableBalanceCents. Never hide those earnings.
    const recordedAvailable = Math.max(0, Number(profile.availableBalanceCents || 0));
    const derivedAvailable = Math.max(0, released - withdrawn);
    const available = Math.max(0, Math.max(recordedAvailable, derivedAvailable) - pendingWithdrawal);

    return NextResponse.json({
      releasedCents: released,
      pendingCents: pending,
      availableCents: available,
      withdrawnCents: withdrawn,
      withdrawals: withdrawalRows
    });
  } catch (error) {
    const x = publicError(error);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
