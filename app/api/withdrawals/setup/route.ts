import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUER = "SaharaSnow";

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const profileRef = db.collection("users").doc(user.uid);
    const snapshot = await profileRef.get();
    const profile = snapshot.data() || {};

    if (profile.totpEnabled && profile.totpSecret) {
      return NextResponse.json({ enabled: true });
    }

    const secret = String(profile.totpSecret || authenticator.generateSecret());
    const email = user.email || profile.email || `seller-${user.uid.slice(0, 8)}@saharasnow.com`;
    const uri = authenticator.keyuri(email, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
    });

    await profileRef.set({
      totpSecret: secret,
      totpEnabled: false,
      totpSetupStartedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({
      enabled: false,
      qrDataUrl,
      secretKey: secret,
      account: email,
      issuer: ISSUER,
    });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = await req.json() as { code?: unknown };
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) {
      return NextResponse.json({ error: "Enter the six-digit authenticator code." }, { status: 400 });
    }

    const profileRef = db.collection("users").doc(user.uid);
    const snapshot = await profileRef.get();
    const profile = snapshot.data() || {};
    const secret = String(profile.totpSecret || "");
    if (!secret) {
      return NextResponse.json({ error: "Start authenticator setup again." }, { status: 400 });
    }
    if (!authenticator.check(code, secret)) {
      return NextResponse.json({ error: "That authenticator code is invalid or expired." }, { status: 400 });
    }

    await profileRef.set({
      totpEnabled: true,
      totpVerifiedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ enabled: true });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
