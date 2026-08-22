import { NextRequest,NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { authenticator } from "otplib";
import { Resend } from "resend";
import { db } from "@/lib/firebase-admin";
import { publicError,required,userFromRequest } from "@/lib/server";
import { notifyAdminInApp, notifyUser } from "@/lib/notifications";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const MIN_WITHDRAWAL_CENTS=500;
const WITHDRAWAL_FEE_RATE=0.05;
const CURRENCY="USD" as const;
const paidStatuses=new Set(["paid","completed","processed","paid-out","paid-manually"]);
const pendingStatuses=new Set(["pending","pending-manual-payment","processing"]);

function currencyPendingCents(withdrawalsSnap:FirebaseFirestore.QuerySnapshot,currency:"USDT"|"USDC"){
  return withdrawalsSnap.docs
    .filter(d=>pendingStatuses.has(String(d.data()?.status||""))&&String(d.data()?.currency||"").toUpperCase()===currency)
    .reduce((n,d)=>n+Math.max(0,Number(d.data()?.grossCents||0)),0);
}

async function balanceForSeller(uid:string){
  const [profileSnap,ordersSnap,withdrawalsSnap]=await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("orders").where("sellerId","==",uid).limit(500).get(),
    db.collection("withdrawals").where("sellerId","==",uid).limit(200).get()
  ]);
  const profile=profileSnap.data()||{};
  const released=ordersSnap.docs
    .filter(d=>String(d.data()?.status||"")==="completed-released")
    .reduce((n,d)=>n+Math.max(0,Number(d.data()?.sellerNetCents||0)),0);
  const paid=withdrawalsSnap.docs
    .filter(d=>paidStatuses.has(String(d.data()?.status||"")))
    .reduce((n,d)=>n+Math.max(0,Number(d.data()?.grossCents??d.data()?.netCents??0)),0);
  const pending=withdrawalsSnap.docs
    .filter(d=>pendingStatuses.has(String(d.data()?.status||"")))
    .reduce((n,d)=>n+Math.max(0,Number(d.data()?.grossCents||0)),0);

  // The profile balance is the authoritative running balance. Older released
  // orders are used as a fallback only, so a rejected withdrawal cannot stay
  // locked by being subtracted a second time.
  const recorded=Math.max(0,Number(profile.availableBalanceCents||0));
  const derived=Math.max(0,released-paid);
  const profileAlreadyReservesPending=Number(profile.pendingWithdrawalCents||0)>0;
  const base=Math.max(recorded,derived);
  const available=Math.max(0,profileAlreadyReservesPending?recorded:base-pending);

  // Each seller balance is tracked per settlement currency (USDT/USDC) as
  // released crypto orders come in - see the balanceField increment in
  // app/api/cron/release-crypto-orders/route.ts. A withdrawal can only be
  // paid out in one currency, so validate and reserve against that specific
  // bucket rather than the combined total.
  const usdtStored=Math.max(0,Number(profile.usdtBalanceCents||0));
  const usdcStored=Math.max(0,Number(profile.usdcBalanceCents||0));
  const usdtAvailable=Math.max(0,usdtStored-currencyPendingCents(withdrawalsSnap,"USDT"));
  const usdcAvailable=Math.max(0,usdcStored-currencyPendingCents(withdrawalsSnap,"USDC"));
  return {profile,available,released,pending,usdtAvailable,usdcAvailable};
}

export async function GET(req:NextRequest){
  try{
    const user=await userFromRequest(req);
    const {available,usdtAvailable,usdcAvailable}=await balanceForSeller(user.uid);
    const snap=await db.collection("withdrawals").where("sellerId","==",user.uid).limit(200).get();
    return NextResponse.json({
      currency:CURRENCY,
      minWithdrawalCents:MIN_WITHDRAWAL_CENTS,
      availableCents:available,
      usdtAvailableCents:usdtAvailable,
      usdcAvailableCents:usdcAvailable,
      withdrawals:snap.docs.map(d=>({id:d.id,...d.data()}))
    });
  }catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}
}

export async function POST(req:NextRequest){
  try{
    const user=await userFromRequest(req);
    const body=await req.json();
    const totp=String(body?.totp||"");
    const requested=Number(body?.amountCents);
    const currency=String(body?.currency||"").toUpperCase();
    if(currency!=="USDT"&&currency!=="USDC")throw new Error("Choose USDT or USDC to withdraw to.");
    if(!Number.isFinite(requested)||!Number.isInteger(requested)||requested<=0)throw new Error("Enter a valid withdrawal amount in whole cents");
    if(requested<MIN_WITHDRAWAL_CENTS)throw new Error("The minimum withdrawal is $5.00");

    let gross=0;let withdrawalId="";let feeCents=0;let netCents=0;let remainingAvailableCents=0;
    await db.runTransaction(async tx=>{
      const userRef=db.collection("users").doc(user.uid);
      const profile=(await tx.get(userRef)).data();
      if(!profile?.totpEnabled||!profile?.totpSecret||!authenticator.check(totp,profile.totpSecret))throw new Error("Google Authenticator verification is required before requesting a withdrawal");

      // Recalculate inside the transaction from the user's stored balance and
      // active requests. This prevents a rejected request from leaving the UI
      // disabled because of a stale client-side maximum.
      const withdrawalsQuery=db.collection("withdrawals").where("sellerId","==",user.uid);
      const withdrawals=await tx.get(withdrawalsQuery);
      const balanceField=currency==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
      const storedCurrencyBalance=Math.max(0,Number(profile?.[balanceField]||0));
      const currencyPending=currencyPendingCents(withdrawals,currency as "USDT"|"USDC");
      const available=Math.max(0,storedCurrencyBalance-currencyPending);
      if(requested>available)throw new Error(`Withdrawal amount cannot exceed your available ${currency} balance of $${(available/100).toFixed(2)}`);

      const pending=withdrawals.docs
        .filter(d=>pendingStatuses.has(String(d.data()?.status||"")))
        .reduce((sum,d)=>sum+Math.max(0,Number(d.data()?.grossCents||0)),0);

      gross=requested;
      feeCents=Math.round(gross*WITHDRAWAL_FEE_RATE);
      netCents=gross-feeCents;
      remainingAvailableCents=Math.max(0,available-gross);
      const ref=db.collection("withdrawals").doc();
      withdrawalId=ref.id;
      tx.create(ref,{sellerId:user.uid,grossCents:gross,feeCents,netCents,status:"pending-manual-payment",currency,feeRate:WITHDRAWAL_FEE_RATE,requestedAt:new Date()});
      tx.set(userRef,{
        [balanceField]:FieldValue.increment(-gross),
        availableBalanceCents:FieldValue.increment(-gross),
        pendingWithdrawalCents:pending+gross,
        updatedAt:new Date()
      },{merge:true});
    });

    const profile=(await db.collection("users").doc(user.uid).get()).data();
    await notifyUser({userId:user.uid,type:"withdrawal_requested",eventId:withdrawalId,title:"Withdrawal requested",message:`Your withdrawal request for ${(gross/100).toFixed(2)} ${currency} was submitted.`,link:"/?seller=1",email:true});
    await notifyAdminInApp({type:"withdrawal_requested",eventId:withdrawalId,title:"New withdrawal request",message:`A seller requested a manual ${currency} withdrawal of ${(gross/100).toFixed(2)}.`,link:"/admin"});
    const resend=new Resend(required("RESEND_API_KEY"));
    const html=`<h1>SaharaSnow withdrawal request</h1><p>Request ${withdrawalId}</p><p>Currency: ${currency}</p><p>Gross: ${(gross/100).toFixed(2)} ${currency}</p><p>Fee (5%): ${(feeCents/100).toFixed(2)} ${currency}</p><p>Manual payout: ${(netCents/100).toFixed(2)} ${currency}</p>`;
    await resend.emails.send({from:required("EMAIL_FROM"),to:[required("ADMIN_EMAIL"),profile?.email].filter(Boolean),subject:"New SaharaSnow withdrawal request",html});
    return NextResponse.json({id:withdrawalId,currency,minWithdrawalCents:MIN_WITHDRAWAL_CENTS,grossCents:gross,feeCents,netCents,remainingAvailableCents});
  }catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}
}
