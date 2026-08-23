import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase-admin";
import { otpHash, REGISTRATION_LIMIT_MESSAGE, reserveRegistrationSlot, safeEqual } from "@/lib/server";
import { notifyAdmin } from "@/lib/admin-notifications";

const schema = z.object({email: z.string().email(), code: z.string().regex(/^\d{6}$/), purpose: z.enum(["login", "register"]).default("login")});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json()); const email = body.email.toLowerCase().trim();
    const ref = db.collection("loginCodes").doc(email); const snap = await ref.get(); const data = snap.data();
    if (!data || data.purpose !== body.purpose || data.attempts >= 5 || data.expiresAt.toMillis() < Date.now() || !safeEqual(data.hash, otpHash(email, body.code))) {
      await ref.set({attempts: (data?.attempts ?? 0)+1}, {merge:true});
      return NextResponse.json({error:"Invalid or expired code"},{status:401});
    }
    let user; let created = false;
    try { user = await adminAuth.getUserByEmail(email); }
    catch (error: unknown) {
      if (body.purpose !== "register" || (error as {code?: string})?.code !== "auth/user-not-found") throw error;
      try { await reserveRegistrationSlot(); } catch { return NextResponse.json({error: REGISTRATION_LIMIT_MESSAGE}, {status: 403}); }
      user = await adminAuth.createUser({email,emailVerified:true}); created = true;
    }
    if (!created) {
      const profile = (await db.collection("users").doc(user.uid).get()).data() || {};
      if (user.disabled || profile.accountStatus === "suspended") {
        await ref.delete();
        return NextResponse.json({error: "This account is suspended. Login is currently disabled."}, {status: 403});
      }
    }
    const profileUpdate:Record<string,unknown>={email,updatedAt:new Date()};
    if(created){profileUpdate.joinedAt=new Date();profileUpdate.mode="BUYING";profileUpdate.kycStatus="not-started";}
    await db.collection("users").doc(user.uid).set(profileUpdate,{merge:true});
    if(created)await notifyAdmin({subject:`New SaharaSnow user: ${email}`,heading:"A new user registered",message:"A new account has been created on the marketplace.",details:{Email:email,"User ID":user.uid,"Registered at":new Date().toLocaleString("en-GB",{timeZone:"Europe/Nicosia"})},actionLabel:"View users in admin",actionPath:"/admin"});
    const customToken = await adminAuth.createCustomToken(user.uid);
    await ref.delete();
    return NextResponse.json({customToken});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify security code";
    console.error("Login-code verification failed", {message});
    return NextResponse.json({error: message}, {status: 500});
  }
}
