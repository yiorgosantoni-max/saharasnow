import { NextResponse } from "next/server";
import { SIGNUP_SLOT_CAP, signupSlotPeriod, signupSlotsRemaining } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const remaining = await signupSlotsRemaining();
    return NextResponse.json({ remaining, cap: SIGNUP_SLOT_CAP, period: signupSlotPeriod() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load signup slots" }, { status: 500 });
  }
}
