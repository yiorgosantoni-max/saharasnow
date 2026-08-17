import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const users = await db.collection("users").limit(1000).get();
    const orders = await db.collection("orders").limit(2000).get();
    const withdrawals = await db.collection("withdrawals").limit(1000).get();
    const byUser = new Map<string, any>();
    for (const d of users.docs) {
      const x = d.data(); byUser.set(d.id, { id:d.id, name:[x.firstName,x.lastName].filter(Boolean).join(" "), email:x.email||"", mode:x.mode||"BUYING", totalEarningsCents:Number(x.totalEarningsCents||0), pendingEarningsCents:Number(x.pendingEarningsCents||0), availableBalanceCents:Number(x.availableBalanceCents||0) });
    }
    let grossCents=0, sellerEarningsCents=0, platformFeesCents=0, pendingWithdrawalsCents=0, paidWithdrawalsCents=0;
    for (const d of orders.docs) { const o=d.data(); grossCents += Number(o.serviceCents||o.amountCents||0); sellerEarningsCents += Number(o.sellerNetCents||0); platformFeesCents += Number(o.platformFeeCents||0); }
    for (const d of withdrawals.docs) { const w=d.data(); const n=Number(w.netCents||0); if (["pending","pending-manual-payment","processing"].includes(String(w.status))) pendingWithdrawalsCents += n; if (["paid","completed","processed","paid-out"].includes(String(w.status))) paidWithdrawalsCents += n; }
    const sellers = [...byUser.values()].filter(x=>x.mode==="SELLER" || x.totalEarningsCents>0).sort((a,b)=>b.totalEarningsCents-a.totalEarningsCents);
    return NextResponse.json({ grossCents, sellerEarningsCents, platformFeesCents, pendingWithdrawalsCents, paidWithdrawalsCents, sellers });
  } catch (error) { const x=publicError(error); return NextResponse.json({error:x.message},{status:x.status}); }
}
