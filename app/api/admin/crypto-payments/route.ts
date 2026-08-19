import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const actionSchema=z.object({invoiceId:z.string().min(1),action:z.enum(["confirm","reject"]),note:z.string().trim().max(1000).default("")});
async function assertAdmin(req:NextRequest){const token=await userFromRequest(req);const email=String(token.email||"").toLowerCase();const allowed=String(process.env.SUPER_ADMIN_EMAIL||process.env.ADMIN_EMAIL||"").toLowerCase();if(!allowed||email!==allowed)throw new Error("FORBIDDEN");return token;}
const serial=(x:any)=>({id:x.id,...x.data()});

export async function GET(req:NextRequest){try{await assertAdmin(req);const snap=await db.collection("customInvoices").where("status","==","payment-submitted").limit(200).get();return NextResponse.json({payments:snap.docs.map(serial)});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PATCH(req:NextRequest){try{const admin=await assertAdmin(req);const body=actionSchema.parse(await req.json());const ref=db.collection("customInvoices").doc(body.invoiceId);let result:any={};await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error("NOT_FOUND");const invoice=snap.data()||{};if(String(invoice.status)!=="payment-submitted")throw new Error("This payment is no longer awaiting confirmation.");if(body.action==="reject"){tx.set(ref,{status:"payment-rejected",adminNote:body.note,reviewedBy:admin.uid,reviewedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});result={buyerId:String(invoice.buyerId),orderNumber:String(invoice.orderNumber||body.invoiceId),amountCents:Number(invoice.amountCents||0),action:"reject"};return;}
const buyerId=String(invoice.buyerId||"");const amountCents=Math.max(0,Math.round(Number(invoice.amountCents||0)));if(!buyerId||!amountCents)throw new Error("Invalid payment record.");const buyerRef=db.collection("users").doc(buyerId);const buyerSnap=await tx.get(buyerRef);if(!buyerSnap.exists)throw new Error("BUYER_NOT_FOUND");const ledgerRef=db.collection("balanceTransactions").doc(body.invoiceId);const ledgerSnap=await tx.get(ledgerRef);if(ledgerSnap.exists)throw new Error("This payment has already been credited.");tx.set(buyerRef,{availableBalanceCents:FieldValue.increment(amountCents),updatedAt:FieldValue.serverTimestamp()},{merge:true});tx.set(ledgerRef,{userId:buyerId,type:"crypto-usdt-deposit",amountCents,currency:"USDT",invoiceId:body.invoiceId,orderNumber:String(invoice.orderNumber||body.invoiceId),txHash:String(invoice.txHash||""),status:"confirmed",createdAt:FieldValue.serverTimestamp(),confirmedBy:admin.uid});tx.set(ref,{status:"payment-confirmed",balanceCredited:true,adminNote:body.note,reviewedBy:admin.uid,reviewedAt:FieldValue.serverTimestamp(),balanceCreditedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});result={buyerId,orderNumber:String(invoice.orderNumber||body.invoiceId),amountCents,action:"confirm"};});
return NextResponse.json({ok:true,...result});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
