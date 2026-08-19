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

export async function POST(req:NextRequest){try{
 const user=await userFromRequest(req); const body=createSchema.parse(await req.json());
 if(user.uid===body.sellerId)return NextResponse.json({error:"Choose a different seller."},{status:400});
 const seller=await db.collection("users").doc(body.sellerId).get(); if(!seller.exists)return NextResponse.json({error:"Seller not found."},{status:404});
 const invoiceRef=db.collection("customInvoices").doc();
 await invoiceRef.set({buyerId:user.uid,sellerId:body.sellerId,title:body.title,description:body.description,amountCents:body.amountCents,serviceCents:body.amountCents,platformFeeCents:0,stripeMarkupCents:0,checkoutTotalCents:body.amountCents,currency:"USDT",network:"TRC20",depositAddress:USDT_TRC20_ADDRESS,status:"awaiting-crypto-payment",paymentMethod:"crypto-usdt-trc20",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 return NextResponse.json({invoiceId:invoiceRef.id,amountCents:body.amountCents,currency:"USDT",network:"TRC20",depositAddress:USDT_TRC20_ADDRESS,serviceCents:body.amountCents,stripeMarkupCents:0,platformFeeCents:0,checkoutTotalCents:body.amountCents});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PUT(req:NextRequest){try{
 const user=await userFromRequest(req); const {invoiceId,txHash}=submittedSchema.parse(await req.json());
 const invoiceRef=db.collection("customInvoices").doc(invoiceId),snap=await invoiceRef.get(); if(!snap.exists)return NextResponse.json({error:"Invoice not found."},{status:404});
 const invoice=snap.data()||{}; if(String(invoice.buyerId)!==user.uid)return NextResponse.json({error:"Forbidden"},{status:403});
 if(!["awaiting-crypto-payment","payment-submitted"].includes(String(invoice.status)))return NextResponse.json({error:"This invoice can no longer accept a payment reference."},{status:400});
 await invoiceRef.set({status:"payment-submitted",txHash,cryptoSubmittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
 await notifyAdminInApp({type:"crypto_payment_submitted",eventId:invoiceId,title:"USDT payment submitted",message:`Custom order payment reference submitted for ${String(invoice.title)}. Verify the TRC20 transaction before releasing the order.`,link:"/admin"});
 await notifyUser({userId:user.uid,type:"crypto_payment_submitted",eventId:invoiceId,title:"USDT payment submitted",message:"Your payment reference was received and is awaiting verification.",link:"/?inbox=1"});
 return NextResponse.json({ok:true,status:"payment-submitted"});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
