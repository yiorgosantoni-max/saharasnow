import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { resolveCryptoDeposit } from "@/lib/crypto-deposit";
import { notifyAdminInApp } from "@/lib/notifications";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QR_BASE = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=";
const MIN_TIP_CENTS = 100;      // $1.00
const MAX_TIP_CENTS = 100000;   // $1,000.00

const createSchema = z.object({
  reviewId: z.string().min(1).max(200),
  amountCents: z.number().int().min(MIN_TIP_CENTS).max(MAX_TIP_CENTS),
  currency: z.enum(["USDT", "USDC"]),
});
const submitSchema = z.object({
  tipId: z.string().min(1).max(200),
  txHash: z.string().trim().min(16).max(200),
});

/**
 * Buyer tips a seller after leaving a review. Tips follow the same custodial
 * path as orders: the buyer sends crypto to the platform deposit address, an
 * administrator verifies the transaction, and only then is the seller's
 * balance credited. Nothing is credited on the buyer's word alone.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = createSchema.parse(await req.json());

    const reviewSnap = await db.collection("reviews").doc(body.reviewId).get();
    if (!reviewSnap.exists) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    const review = reviewSnap.data() || {};
    if (String(review.buyerId) !== user.uid) return NextResponse.json({ error: "Only the buyer who wrote this review can tip on it." }, { status: 403 });
    const sellerId = String(review.sellerId || "");
    if (!sellerId) return NextResponse.json({ error: "This review has no seller attached." }, { status: 400 });

    // One unpaid tip per review at a time, so a buyer can't spawn endless
    // pending records; already-paid tips don't block a further tip.
    const existing = await db.collection("tips").where("reviewId", "==", body.reviewId).where("status", "in", ["awaiting-payment", "submitted"]).limit(1).get();
    if (!existing.empty) {
      const doc = existing.docs[0];
      const d = doc.data() || {};
      return NextResponse.json({ id: doc.id, amountCents: Number(d.amountCents || 0), currency: String(d.currency || ""), network: String(d.network || ""), depositAddress: String(d.depositAddress || ""), qrCodeUrl: `${QR_BASE}${encodeURIComponent(String(d.depositAddress || ""))}`, status: String(d.status || ""), existing: true });
    }

    const { network, address } = resolveCryptoDeposit(body.currency);
    if (!address) return NextResponse.json({ error: `${body.currency} tipping is not configured yet.` }, { status: 503 });

    const ref = db.collection("tips").doc();
    await ref.set({
      buyerId: user.uid,
      sellerId,
      reviewId: body.reviewId,
      orderId: String(review.orderId || body.reviewId),
      orderNumber: String(review.orderNumber || body.reviewId),
      amountCents: body.amountCents,
      currency: body.currency,
      network,
      depositAddress: address,
      status: "awaiting-payment",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id, amountCents: body.amountCents, currency: body.currency, network, depositAddress: address, qrCodeUrl: `${QR_BASE}${encodeURIComponent(address)}`, status: "awaiting-payment" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: `Enter a tip between $${(MIN_TIP_CENTS / 100).toFixed(2)} and $${(MAX_TIP_CENTS / 100).toFixed(2)}.` }, { status: 400 });
    const x = publicError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}

/** Buyer confirms they sent the crypto and supplies the transaction hash. */
export async function PUT(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = submitSchema.parse(await req.json());
    const ref = db.collection("tips").doc(body.tipId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Tip not found." }, { status: 404 });
    const tip = snap.data() || {};
    if (String(tip.buyerId) !== user.uid) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    if (String(tip.status) !== "awaiting-payment") return NextResponse.json({ error: "This tip has already been submitted." }, { status: 400 });

    await ref.set({ status: "submitted", txHash: body.txHash, submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await notifyAdminInApp({ type: "tip_submitted", eventId: body.tipId, title: "Tip payment submitted", message: `A buyer submitted a ${(Number(tip.amountCents || 0) / 100).toFixed(2)} ${String(tip.currency)} tip for order #${String(tip.orderNumber || "")}. Verify the transaction to credit the seller.`, link: "/admin" });
    return NextResponse.json({ ok: true, status: "submitted" });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Paste the full blockchain transaction hash." }, { status: 400 });
    const x = publicError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}

/** Tips visible to the signed-in user, for a given review. */
export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const reviewId = String(new URL(req.url).searchParams.get("reviewId") || "");
    if (!reviewId) return NextResponse.json({ error: "reviewId is required" }, { status: 400 });
    const snap = await db.collection("tips").where("reviewId", "==", reviewId).limit(20).get();
    const tips = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Record<string, unknown> & { id: string }))
      .filter(t => String(t.buyerId) === user.uid || String(t.sellerId) === user.uid)
      .map(t => ({ id: t.id, amountCents: Number(t.amountCents || 0), currency: String(t.currency || ""), status: String(t.status || ""), orderNumber: String(t.orderNumber || "") }));
    return NextResponse.json({ tips });
  } catch (e) { const x = publicError(e); return NextResponse.json({ error: x.message }, { status: x.status }); }
}

