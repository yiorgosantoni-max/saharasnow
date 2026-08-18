import { NextRequest,NextResponse } from "next/server";
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
const paidStatuses=new Set(["paid","completed","processed","paid-out"]);
const pendingStatuses=new Set(["pending","pending-manual-payment","processing"]);

async function balanceForSeller(uid:string){
  const [profileSnap,ordersSnap,withdrawalsSnap]=await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("orders").where("sellerId","==",uid).limit(500).get(),
    db.collection("withdrawals").where("sellerId","==",uid).limit(200).get()
  ]);
  const profile=profileSnap.data()||{};
  const released=ordersSnap.docs.filter(d=>String(d.data()?.status||"")==="completed-released").reduce((n,d)=>n+Math.max(0,Number(d.data()?.sellerNetCents||0)),0);
  const paid=withdrawalsSnap.docs.filter(d=>paidStatuses.has(String(d.data()?.status||""))).reduce((n,d)=>n+Math.max(0,Number(d.data()?.grossCents??d.data()?.netCents??0)),0);
  const pending=withdrawalsSnap.docs.filter(d=>pendingStatuses.has(String(d.data()?.status||""))).reduce((n,d)=>n+Math.max(0,Number(d.data()?.grossCents||0)),0);
  const available=Math.max(0,Math.max(Number(profile.availableBalanceCents||0),released-paid)-pending);
  return {profile,available};
}

export async function GET(req:NextRequest){try{const user=await userFromRequest(req);const {available}=await balanceForSeller(user.uid);const snap=await db.collection("withdrawals").where("sellerId","==",user.uid).limit(200).get();return NextResponse.json({currency:CURRENCY,minWithdrawalCents:MIN_WITHDRAWAL_CENTS,availableCents:available,withdrawals:snap.docs.map(d=>({id:d.id,...d.data()}))});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function POST(req:NextRequest){try{const user=await userFromRequest(req);const body=await req.json();const totp=String(body?.totp||"");const requestedRaw=body?.amountCents;const requested=Number(requestedRaw);const {available}=await balanceForSeller(user.uid);if(!Number.isFinite(requested)||!Number.isInteger(requested)||requested<=0)throw new Error("Enter a valid withdrawal amount in whole cents");if(requested<MIN_WITHDRAWAL_CENTS)throw new Error("The minimum withdrawal is $5.00");if(requested>available)throw new Error(`Withdrawal amount cannot exceed your available balance of $${(available/100).toFixed(2)}`);
let gross=0;let withdrawalId="";let feeCents=0;let netCents=0;await db.runTransaction(async tx=>{const userRef=db.collection("users").doc(user.uid);const profile=(await tx.get(userRef)).data();if(!profile?.totpEnabled||!profile?.totpSecret||!authenticator.check(totp,profile.totpSecret))throw new Error("Google Authenticator verification is required before requesting a withdrawal");const currentAvailable=Math.max(0,Number(profile.availableBalanceCents||0));gross=requested;feeCents=Math.round(gross*WITHDRAWAL_FEE_RATE);netCents=gross-feeCents;const ref=db.collection("withdrawals").doc();withdrawalId=ref.id;tx.create(ref,{sellerId:user.uid,grossCents:gross,feeCents,netCents,status:"pending-manual-payment",currency:CURRENCY,feeRate:WITHDRAWAL_FEE_RATE,requestedAt:new Date()});tx.set(userRef,{availableBalanceCents:Math.max(0,currentAvailable-gross),pendingWithdrawalCents:Number(profile?.pendingWithdrawalCents||0)+gross},{merge:true});});const profile=(await db.collection("users").doc(user.uid).get()).data();await notifyUser({userId:user.uid,type:"withdrawal_requested",eventId:withdrawalId,title:"Withdrawal requested",message:`Your withdrawal request for $${(gross/100).toFixed(2)} was submitted.`,link:"/?seller=1",email:true});await notifyAdminInApp({type:"withdrawal_requested",eventId:withdrawalId,title:"New withdrawal request",message:`A seller requested a manual withdrawal of $${(gross/100).toFixed(2)}.`,link:"/admin"});const resend=new Resend(required("RESEND_API_KEY"));const html=`<h1>SaharaSnow withdrawal request</h1><p>Request ${withdrawalId}</p><p>Gross: $${(gross/100).toFixed(2)}</p><p>Fee (5%): $${(feeCents/100).toFixed(2)}</p><p>Manual payout: $${(netCents/100).toFixed(2)}</p>`;await resend.emails.send({from:required("EMAIL_FROM"),to:[required("ADMIN_EMAIL"),profile?.email].filter(Boolean),subject:"New SaharaSnow withdrawal request",html});return NextResponse.json({id:withdrawalId,currency:CURRENCY,minWithdrawalCents:MIN_WITHDRAWAL_CENTS,grossCents:gross,feeCents,netCents,remainingAvailableCents:Math.max(0,available-gross)});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
