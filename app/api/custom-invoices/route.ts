import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { notifyAdminInApp, notifyUser } from "@/lib/notifications";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const createSchema=z.object({sellerId:z.string().min(1),title:z.string().trim().min(3).max(160),description:z.string().trim().max(2000).default(""),amountCents:z.number().int().min(500).max(100000000)});
const submittedSchema=z.object({invoiceId:z.string().min(1),txHash:z.string().trim().min(16).max(256)});
const USDT_TRC20_ADDRESS="TKA1h9L4wWjimF8UVVHQLtFYvWv7TTHdnB";
const orderNumber=(id:string)=>`USDT-${id.replace(/[^a-z0-9]/gi,"").slice(-10).toUpperCase()}`;

export async function POST(req:NextRequest){try{
 const user=await userFromRequest(req); const body=createSchema.parse(await req.json());
 if(user.uid===body.sellerId)return NextResponse.json({error:"Choose a different seller."},{status:400});
 const seller=await db.collection("users").doc(body.sellerId).get(); if(!seller.exists)return NextResponse.json({error:"Seller not found."},{status:404});
 const invoiceRef=db.collection("customInvoices").doc(),paymentOrderNumber=orderNumber(invoiceRef.id);
 await invoiceRef.set({buyerId:user.uid,sellerId:body.sellerId,title:body.title,description:body.description,amountCents:body.amountCents,serviceCents:body.amountCents,platformFeeCents:0,stripeMarkupCents:0,checkoutTotalCents:body.amountCents,currency:"USDT",network:"TRC20",depositAddress:USDT_TRC20_ADDRESS,orderNumber:paymentOrderNumber,status:"awaiting-crypto-payment",paymentMethod:"crypto-usdt-trc20",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 return NextResponse.json({invoiceId:invoiceRef.id,orderNumber:paymentOrderNumber,amountCents:body.amountCents,currency:"USDT",network:"TRC20",depositAddress:USDT_TRC20_ADDRESS,serviceCents:body.amountCents,stripeMarkupCents:0,platformFeeCents:0,checkoutTotalCents:body.amountCents});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PUT(req:NextRequest){try{
 const user=await userFromRequest(req); const {invoiceId,txHash}=submittedSchema.parse(await req.json()); const normalizedTxHash=txHash.trim().toLowerCase();
 const invoiceRef=db.collection("customInvoices").doc(invoiceId),snap=await invoiceRef.get(); if(!snap.exists)return NextResponse.json({error:"Invoice not found."},{status:404});
 const invoice=snap.data()||{}; if(String(invoice.buyerId)!==user.uid)return NextResponse.json({error:"Forbidden"},{status:403});
 if(!["awaiting-crypto-payment","payment-submitted"].includes(String(invoice.status)))return NextResponse.json({error:"This invoice can no longer accept a payment reference."},{status:400});
 const existing=await db.collection("customInvoices").where("txHashNormalized","==",normalizedTxHash).limit(1).get();
 if(!existing.empty&&existing.docs.some(d=>d.id!==invoiceId))return NextResponse.json({error:"This transaction hash has already been used for another payment."},{status:409});
 await invoiceRef.set({status:"payment-submitted",txHash:txHash.trim(),txHashNormalized:normalizedTxHash,cryptoSubmittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
 const no=String(invoice.orderNumber||orderNumber(invoiceId));
 await notifyAdminInApp({type:"crypto_payment_submitted",eventId:invoiceId,title:`USDT payment submitted — ${no}`,message:`${no} has a submitted TRC20 transaction hash. Verify it, then confirm to credit the customer's available balance.`,link:"/admin/crypto-payments"});
 await notifyUser({userId:user.uid,type:"crypto_payment_submitted",eventId:invoiceId,title:`Payment submitted — ${no}`,message:"Your USDT payment is awaiting administrator confirmation. Your available balance will be credited only after confirmation.",link:"/?inbox=1"});
 return NextResponse.json({ok:true,status:"payment-submitted",orderNumber:no});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
