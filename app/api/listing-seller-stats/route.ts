import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const listingId = req.nextUrl.searchParams.get("listingId")?.trim();
    if (!listingId) return NextResponse.json({ error: "listingId is required" }, { status: 400 });

    const listingSnap = await db.collection("listings").doc(listingId).get();
    if (!listingSnap.exists) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

    const sellerId = String(listingSnap.data()?.sellerId || "");
    if (!sellerId) return NextResponse.json({ sellerId: "", orderCount: 0, reviewCount: 0, averageRating: 0 });

    // These are service-level stats, not seller-wide stats, so the badge and rating on
    // every card describe the actual service being viewed. orderCount counts every order
    // the buyer has actually submitted payment for (transaction hash sent), not just ones
    // that finished the full approval/clearance pipeline - only a still-empty checkout that
    // never got a payment reference is excluded.
    const unplacedStatuses = ["awaiting-crypto-payment"];
    const [ordersSnap, reviewsSnap] = await Promise.all([
      db.collection("orders").where("listingId", "==", listingId).get(),
      db.collection("reviews").where("listingId", "==", listingId).get(),
    ]);
    const orderCount = ordersSnap.docs.filter((doc) => !unplacedStatuses.includes(String(doc.data()?.status))).length;

    const ratings = reviewsSnap.docs
      .map((doc) => Number(doc.data()?.rating))
      .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
    const reviewCount = ratings.length;
    const averageRating = reviewCount ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / reviewCount).toFixed(1)) : 0;

    return NextResponse.json({ sellerId, orderCount, reviewCount, averageRating });
  } catch {
    return NextResponse.json({ sellerId: "", orderCount: 0, reviewCount: 0, averageRating: 0 });
  }
}
