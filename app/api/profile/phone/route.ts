import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUTH_AGE_SECONDS = 600;

/**
 * Server-side authorization gate the client must clear BEFORE asking Firebase
 * to send an SMS. Firebase Phone Auth sends the message directly from the
 * browser and knows nothing about KYC, so without this check a non-verified
 * user could still burn SMS quota even though POST would refuse to save the
 * resulting number. Checking here means the SMS is never requested at all.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const profile = (await db.collection("users").doc(user.uid).get()).data() || {};
    const kycStatus = String(profile.kycStatus || "not-started");
    const kycApproved = kycStatus === "approved";
    return NextResponse.json({
      kycApproved,
      kycStatus,
      phoneVerified: Boolean(profile.phoneVerified),
      reason: kycApproved ? "" : "Complete KYC identity verification before setting up SMS one-time codes.",
    });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

/**
 * Persists a phone number Firebase already verified client-side (via
 * linkWithCredential/reauthenticateWithCredential). The phone_number claim on
 * the decoded ID token can only be set by Firebase itself after a real SMS
 * code was confirmed, so this endpoint never has to verify a code directly.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const profileSnap = await db.collection("users").doc(user.uid).get();
    const kycStatus = String(profileSnap.data()?.kycStatus || "not-started");
    if (kycStatus !== "approved") throw new Error("Complete KYC identity verification before setting up SMS one-time codes.");
    const phoneNumber = String(user.phone_number || "").trim();
    if (!phoneNumber) throw new Error("No verified phone number found on this session. Verify your phone number again.");
    const authTime = Number(user.auth_time || 0);
    if (!authTime || Date.now() / 1000 - authTime > MAX_AUTH_AGE_SECONDS) throw new Error("Your phone verification has expired. Please verify again.");
    await db.collection("users").doc(user.uid).set({ phoneNumber, phoneVerified: true, phoneVerifiedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, phoneNumber });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
