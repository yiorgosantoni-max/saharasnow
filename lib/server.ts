import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { adminAuth } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export function required(name: string) {
  let value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  if (name === "RESEND_API_KEY") {
    value = value.replace(/^RESEND_API_KEY\s*=\s*/i, "").trim();
    value = value.replace(/^(['"])(.*)\1$/, "$2").trim();
  }
  return value;
}

export function otpHash(email: string, code: string) {
  return createHash("sha256").update(`${email.toLowerCase()}:${code}:${required("OTP_HASH_SECRET")}`).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export async function userFromRequest(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHENTICATED");
  return adminAuth.verifyIdToken(token, true);
}

export const SIGNUP_SLOT_CAP = 300;
/**
 * Signup slots are capped per calendar month. Rather than resetting a shared
 * counter on a schedule (which needs a cron job and can fire late, early or
 * twice), the counter document is keyed by month: "2026-08", "2026-09", ...
 * A new month therefore starts at zero automatically with no moving parts.
 * Months are computed in UTC so the rollover moment is unambiguous.
 */
export function signupSlotPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Read-only check of how many slots are left this month. Not transactional — use claimSignupSlot() for the authoritative, race-safe reservation. */
export async function signupSlotsRemaining() {
  const { db } = await import("./firebase-admin");
  const snap = await db.collection("meta").doc(`signupSlots-${signupSlotPeriod()}`).get();
  const used = Number(snap.data()?.usedSlots || 0);
  return Math.max(0, SIGNUP_SLOT_CAP - used);
}

/** Atomically reserves one of this month's SIGNUP_SLOT_CAP signup slots. Throws if none remain. */
export async function claimSignupSlot(uid: string) {
  const { db } = await import("./firebase-admin");
  const period = signupSlotPeriod();
  const ref = db.collection("meta").doc(`signupSlots-${period}`);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = Number(snap.data()?.usedSlots || 0);
    if (used >= SIGNUP_SLOT_CAP) throw new Error(`Registration is full for this month — all ${SIGNUP_SLOT_CAP} places have been taken. New places open on the 1st.`);
    tx.set(ref, { period, usedSlots: used + 1, lastClaimedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return used + 1;
  });
}

/**
 * Buyers pay a 1% service fee on top of the listing price. The buyer sends
 * service + fee; the platform retains the fee and only the service amount is
 * ever credited to the seller. Defined once here so every checkout path
 * (listing, custom order, custom invoice, admin) charges the same rate.
 */
export const BUYER_FEE_RATE = 0.01;

export function buyerFeeBreakdown(serviceCents: number) {
  const service = Math.max(0, Math.round(serviceCents));
  const fee = Math.round(service * BUYER_FEE_RATE);
  return { serviceCents: service, buyerFeeCents: fee, checkoutTotalCents: service + fee, sellerNetCents: service };
}

export function orderNumberFor(id: string, currency = "USD") {
  return `${currency}-${id.replace(/[^a-z0-9]/gi, "").slice(-10).toUpperCase()}`;
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return message === "UNAUTHENTICATED" ? {message, status: 401} : {message, status: 400};
}

export async function releaseEligibleSellerOrders(userId: string) {
  const snap = await (await import("./firebase-admin")).db.collection("orders").where("sellerId", "==", userId).where("status", "==", "paid").limit(200).get();
  const now = Date.now();
  for (const doc of snap.docs) {
    const data = doc.data();
    // Crypto orders must be released explicitly by an administrator. They are
    // intentionally excluded from the automatic dispute-window release path.
    if (["usdt-trc20","usdc-bep20","usdc-solana","crypto-usdt-trc20"].includes(String(data.paymentMethod||""))) continue;
    const deadline = data.disputeDeadline && typeof data.disputeDeadline.toDate === "function" ? data.disputeDeadline.toDate() : data.disputeDeadline instanceof Date ? data.disputeDeadline : null;
    if (!deadline || deadline.getTime() > now) continue;
    const net = Number(data.sellerNetCents ?? data.serviceCents ?? 0);
    if (net <= 0) continue;
    const { db } = await import("./firebase-admin");
    let released = false;
    await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.status !== "paid") return;
      tx.update(doc.ref, {status:"completed-released",releasedAt:new Date(),releaseReason:"dispute-window-expired",updatedAt:FieldValue.serverTimestamp()});
      tx.set(db.collection("users").doc(userId), {availableBalanceCents:FieldValue.increment(net)}, {merge:true});
      released = true;
    });
    if (released) {
      const { notifyUser } = await import("./notifications");
      await notifyUser({userId,type:"earnings_released",eventId:doc.id,title:"Order earnings released",message:`€${(net/100).toFixed(2)} from order #${String(data.orderNumber||doc.id)} is now available in your seller balance.`,link:"/?seller=1",email:true});
    }
  }
}
