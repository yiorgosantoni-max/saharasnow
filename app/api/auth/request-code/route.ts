import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase-admin";
import { otpHash, required } from "@/lib/server";

const schema = z.object({email: z.string().email().max(254), purpose: z.enum(["login", "register"]).default("login")});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const {email: rawEmail, purpose} = schema.parse(await req.json());
    const email = rawEmail.toLowerCase().trim();
    let existingUser = null;
    try { existingUser = await adminAuth.getUserByEmail(email); } catch (error: unknown) {
      if ((error as {code?: string})?.code !== "auth/user-not-found") throw error;
    }
    if (purpose === "register" && existingUser) {
      return NextResponse.json({error: "Email already registered"}, {status: 409});
    }
    if (purpose === "login" && !existingUser) {
      return NextResponse.json({error: "No account is registered with this email"}, {status: 404});
    }
    if (purpose === "login" && existingUser) {
      const profile = (await db.collection("users").doc(existingUser.uid).get()).data() || {};
      if (existingUser.disabled || profile.accountStatus === "suspended") {
        // Do not issue or email a login code to suspended users.
        return NextResponse.json({error: "This account is suspended. Login is currently disabled."}, {status: 403});
      }
    }
    const code = randomInt(100000, 1000000).toString();
    const codeRef = db.collection("loginCodes").doc(email);
    const old = await codeRef.get();
    const data = old.data();
    if (data?.lastSentAt?.toMillis?.() > Date.now() - 60_000) {
      return NextResponse.json({error: "Please wait 60 seconds before requesting another code."}, {status: 429});
    }

    await codeRef.set({
      hash: otpHash(email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      purpose,
      status: "sending"
    });

    const resend = new Resend(required("RESEND_API_KEY"));
    const result = await resend.emails.send({
      from: required("EMAIL_FROM"),
      to: email,
      subject: `${code} is your SaharaSnow sign-in code`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h1 style="color:#075ee8">SaharaSnow</h1><p>Use this one-time code to sign in:</p><p style="font-size:34px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`
    });

    if (result.error) {
      console.error("Resend rejected login-code email", {
        name: result.error.name,
        message: result.error.message
      });
      await codeRef.delete();
      return NextResponse.json(
        {error: `Email provider rejected the message: ${result.error.message}`},
        {status: 502}
      );
    }

    await codeRef.update({
      status: "sent",
      lastSentAt: FieldValue.serverTimestamp(),
      resendEmailId: result.data?.id ?? null
    });
    return NextResponse.json({ok: true});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send security code";
    console.error("Login-code email failed", {message});
    return NextResponse.json({error: message}, {status: 500});
  }
}
