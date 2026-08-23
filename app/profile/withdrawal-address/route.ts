import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  currency: z.enum(["USDT", "USDC"]),
  address: z.string().trim().min(20).max(64),
  confirmNetwork: z.literal(true),
});

const addressPattern: Record<"USDT" | "USDC", RegExp> = {
  USDT: /^T[a-zA-Z0-9]{33}$/,
  USDC: /^0x[a-fA-F0-9]{40}$/,
};
const networkLabel: Record<"USDT" | "USDC", string> = {
  USDT: "Tron (TRC20)",
  USDC: "BNB Smart Chain (BEP20)",
};

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = schema.parse(await req.json());
    if (!addressPattern[body.currency].test(body.address)) throw new Error(`Enter a valid ${body.currency} address for the ${networkLabel[body.currency]} network.`);

    const addressField = body.currency === "USDC" ? "usdcWithdrawAddress" : "usdtWithdrawAddress";
    const networkField = body.currency === "USDC" ? "usdcWithdrawAddressNetwork" : "usdtWithdrawAddressNetwork";
    const confirmedAtField = body.currency === "USDC" ? "usdcWithdrawAddressConfirmedAt" : "usdtWithdrawAddressConfirmedAt";
    await db.collection("users").doc(user.uid).set({
      [addressField]: body.address,
      [networkField]: networkLabel[body.currency],
      [confirmedAtField]: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ ok: true, currency: body.currency, address: body.address, network: networkLabel[body.currency] });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid withdrawal address and confirm the network." }, { status: 400 });
    const result = publicError(error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
