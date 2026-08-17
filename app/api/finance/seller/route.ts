import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const profile = (await db.collection("users").doc(user.uid).get()).data() || {};
    const [orders, withdrawals] = await Promise.all([
      db.collection("orders").where("sellerId", "==", user.uid).limit(500).get(),
      db.collection("withdrawals").where("sellerId", "==", user.uid).limit(200).get()
    ]);
    let released = Number(profile.totalEarningsCents || 0);
    let pending = Number(profile.pendingEarningsCents || 0);
    const orderRows = orders.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!released) released = orderRows.filter((o: any) => ["completed-released"].includes(String(o.status))).reduce((n: number, o: any) => n + Number(o.sellerNetCents || 0), 0);
    if (!pending) pending = orderRows.filter((o: any) => ["paid","in-progress","delivered","disputed"].includes(String(o.status))).reduce((n: number, o: any) => n + Number(o.sellerNetCents || 0), 0);
    const available = Number(profile.availableBalanceCents || 0);
    const withdrawn = withdrawals.docs.filter(d => ["paid","completed","processed","paid-out"].includes(String(d.data()?.status))).reduce((n, d) => n + Number(d.data()?.netCents || 0), 0);
    return NextResponse.json({ releasedCents: released, pendingCents: pending, availableCents: available, withdrawnCents: withdrawn, withdrawals: withdrawals.docs.map(d => ({ id:d.id, ...d.data() })) });
  } catch (error) {
    const x = publicError(error); return NextResponse.json({ error:x.message }, { status:x.status });
  }
}
