import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { publicError, releaseEligibleSellerOrders, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 characters: letters, numbers and underscore only.").optional().or(z.literal("")),
  country: z.string().trim().min(2).max(100),
  mode: z.enum(["BUYING", "SELLER"]).optional(),
  profileImageUrl: z.string().url().optional().or(z.literal(""))
});

function jsonDate(value: unknown) {
  return value && typeof value === "object" && "toDate" in value && typeof (value as {toDate?:unknown}).toDate === "function"
    ? (value as {toDate:()=>Date}).toDate().toISOString() : value;
}

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    await releaseEligibleSellerOrders(user.uid);
    const snap = await db.collection("users").doc(user.uid).get();
    const data = snap.data() || {};
    const [orders, listings] = await Promise.all([db.collection("orders").where("sellerId","==",user.uid).limit(500).get(), db.collection("listings").where("sellerId","==",user.uid).limit(200).get()]);
    const released = orders.docs.filter(d => d.data().status === "completed-released");
    const pending = orders.docs.filter(d => ["paid","in-progress","delivered"].includes(String(d.data().status)));
    const totalEarningsCents = released.reduce((sum,d)=>sum + Number(d.data().sellerNetCents ?? d.data().serviceCents ?? 0),0);
    const pendingEarningsCents = pending.reduce((sum,d)=>sum + Number(d.data().sellerNetCents ?? d.data().serviceCents ?? 0),0);
    return NextResponse.json({profile:{...data,joinedAt:jsonDate(data.joinedAt),updatedAt:jsonDate(data.updatedAt),availableBalanceCents:Number(data.availableBalanceCents||0),usdtBalanceCents:Number(data.usdtBalanceCents||0),usdcBalanceCents:Number(data.usdcBalanceCents||0),totalEarningsCents,pendingEarningsCents,releasedOrderCount:released.length,activeOrderCount:pending.length,activeListingCount:listings.docs.filter(d=>d.data().status==="active").length}});
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({error:result.message},{status:result.status});
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = profileSchema.parse(await req.json());
    const userRef = db.collection("users").doc(user.uid);
    const nextUsername = body.username || "";
    await db.runTransaction(async (tx) => {
      if (nextUsername) {
        // Check the live username field on every account rather than a
        // separate reservation record, so this also catches usernames set
        // before uniqueness was enforced (no reservation doc would exist
        // for those) instead of only new claims made through this check.
        const conflictSnap = await tx.get(db.collection("users").where("username","==",nextUsername).limit(1));
        const conflict = conflictSnap.docs[0];
        if (conflict && conflict.id !== user.uid) throw new Error("That username is already taken.");
      }
      tx.set(userRef, {...body,email:user.email,updatedAt:FieldValue.serverTimestamp()}, {merge:true});
    });
    return NextResponse.json({ok:true});
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({error:result.message},{status:result.status});
  }
}
