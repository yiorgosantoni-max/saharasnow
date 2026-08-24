import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const orderId = String(params.get("orderId") || "");
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    const user = await userFromRequest(req);
    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const order = orderSnap.data() || {};
    if (String(order.sellerId) !== user.uid) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    const reviewSnap = await db.collection("buyerReviews").doc(orderId).get();
    return NextResponse.json({ order: { id: orderId, orderNumber: String(order.orderNumber || orderId), buyerId: String(order.buyerId || ""), status: String(order.status || "") }, reviewed: reviewSnap.exists });
  } catch (e) {
    const x = publicError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const b = await req.json();
    const orderId = String(b.orderId || "");
    const buyerId = String(b.buyerId || "");
    const rating = Number(b.rating);
    const text = String(b.text || "").trim();
    if (!orderId || !buyerId || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 5 || text.length > 2000)
      return NextResponse.json({ error: "Invalid review" }, { status: 400 });
    const order = await db.collection("orders").doc(orderId).get();
    const o = order.data() || {};
    if (!order.exists || String(o.sellerId) !== user.uid || String(o.buyerId) !== buyerId || String(o.status) !== "completed-released")
      return NextResponse.json({ error: "Only the seller of a released order can review the buyer" }, { status: 403 });
    const buyerRef = db.collection("users").doc(buyerId);
    const reviewRef = db.collection("buyerReviews").doc(orderId);
    let reviewId = "";
    await db.runTransaction(async tx => {
      const existing = await tx.get(reviewRef);
      if (existing.exists) throw new Error("This order already has a buyer review");
      const buyerSnap = await tx.get(buyerRef);
      const buyer = buyerSnap.data() || {};
      const nextCount = Number(buyer.buyerReviewCount || 0) + 1;
      const nextSum = Number(buyer.buyerReviewRatingSum || 0) + rating;
      tx.create(reviewRef, { sellerId: user.uid, buyerId, orderId, orderNumber: String(o.orderNumber || orderId), listingId: String(o.listingId || ""), rating, text, createdAt: FieldValue.serverTimestamp() });
      tx.set(buyerRef, { buyerReviewCount: nextCount, buyerReviewRatingSum: nextSum, buyerAverageRating: Number((nextSum / nextCount).toFixed(1)) }, { merge: true });
      reviewId = reviewRef.id;
    });
    await notifyUser({ userId: buyerId, type: "buyer_feedback_received", eventId: orderId, title: "The seller left you feedback", message: `The seller rated your order #${String(o.orderNumber || orderId)} ${rating}/5 and left feedback for you to see in your Orders & invoices tab.`, link: "/?orders=1" });
    return NextResponse.json({ ok: true, id: reviewId });
  } catch (e) {
    const x = publicError(e);
    return NextResponse.json({ error: x.message }, { status: x.status });
  }
}
