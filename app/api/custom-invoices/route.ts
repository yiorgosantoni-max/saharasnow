import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { notifyAdminInApp, notifyUser } from "@/lib/notifications";
import { publicError, required, userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const stripe=new Stripe(required("STRIPE_SECRET_KEY"));
const createSchema=z.object({sellerId:z.string().min(1),title:z.string().trim().min(3).max(160),description:z.string().trim().max(2000).default(""),amountCents:z.number().int().min(500).max(100000000)});
const verifySchema=z.object({sessionId:z.string().min(1)});

export async function POST(req:NextRequest){try{
 const user=await userFromRequest(req); const body=createSchema.parse(await req.json());
 if(user.uid===body.sellerId)return NextResponse.json({error:"Choose a different seller."},{status:400});
 const seller=await db.collection("users").doc(body.sellerId).get(); if(!seller.exists)return NextResponse.json({error:"Seller not found."},{status:404});
 const invoiceRef=db.collection("customInvoices").doc();
 const appUrl=required("APP_URL").replace(/\/$/,"");
 const session=await stripe.checkout.sessions.create({mode:"payment",payment_method_types:["card"],client_reference_id:user.uid,customer_email:undefined,line_items:[{price_data:{currency:"usd",product_data:{name:body.title,description:body.description||undefined},unit_amount:body.amountCents},quantity:1}],metadata:{customInvoiceId:invoiceRef.id,buyerId:user.uid,sellerId:body.sellerId,title:body.title},success_url:`${appUrl}/?customInvoiceSuccess={CHECKOUT_SESSION_ID}`,cancel_url:`${appUrl}/?inbox=1&invoiceCanceled=1`});
 await invoiceRef.set({buyerId:user.uid,sellerId:body.sellerId,title:body.title,description:body.description,amountCents:body.amountCents,currency:"usd",status:"pending",stripeSessionId:session.id,checkoutUrl:session.url,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 return NextResponse.json({invoiceId:invoiceRef.id,checkoutUrl:session.url});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PUT(req:NextRequest){try{
 const user=await userFromRequest(req); const {sessionId}=verifySchema.parse(await req.json());
 const session=await stripe.checkout.sessions.retrieve(sessionId); if(session.client_reference_id!==user.uid)return NextResponse.json({error:"This payment does not belong to you."},{status:403});
 if(session.payment_status!=="paid")return NextResponse.json({error:"Payment has not completed."},{status:400});
 const invoiceId=String(session.metadata?.customInvoiceId||""); const invoiceRef=db.collection("customInvoices").doc(invoiceId); const invoiceSnap=await invoiceRef.get(); if(!invoiceSnap.exists)return NextResponse.json({error:"Invoice not found."},{status:404});
 const invoice=invoiceSnap.data()||{}; if(String(invoice.buyerId)!==user.uid)return NextResponse.json({error:"Forbidden"},{status:403});
 if(invoice.orderId)return NextResponse.json({ok:true,orderId:String(invoice.orderId)});
 const counter=db.collection("counters").doc("orders"); const orderRef=db.collection("orders").doc();
 await db.runTransaction(async tx=>{const latest=await tx.get(invoiceRef); if(latest.data()?.orderId)return; const c=await tx.get(counter); const number=Number(c.data()?.value||1000)+1; tx.set(counter,{value:number},{merge:true}); tx.set(orderRef,{buyerId:user.uid,sellerId:String(invoice.sellerId),listingId:null,orderNumber:number,serviceCents:Number(invoice.amountCents),buyerFeeCents:0,totalCents:Number(invoice.amountCents),currency:"usd",title:String(invoice.title),description:String(invoice.description||""),custom:true,status:"in-progress",stripeSessionId:session.id,paidAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()}); tx.set(invoiceRef,{status:"paid",orderId:orderRef.id,paidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true}); tx.set(orderRef.collection("events").doc(),{type:"order_paid",message:"Custom order payment completed. Work can begin.",actorId:user.uid,createdAt:FieldValue.serverTimestamp()});});
 const order=await orderRef.get(); if(order.exists){const data=order.data()||{}; const n=String(data.orderNumber||orderRef.id); await notifyUser({userId:String(data.sellerId),type:"order_in_progress",eventId:orderRef.id,title:`New custom order #${n}`,message:"Payment is confirmed. Your order is in progress — open the delivery page when your files are ready.",link:`/?order=${orderRef.id}`,email:true}); await notifyAdminInApp({type:"custom_order_paid",eventId:orderRef.id,title:"Custom order paid",message:`Custom order #${n} is now in progress and ready for delivery tracking.`,link:"/admin"}); const conversationId=[user.uid,String(data.sellerId)].sort().join("_"); await db.collection("conversations").doc(conversationId).set({participants:[user.uid,String(data.sellerId)],updatedAt:FieldValue.serverTimestamp(),lastMessage:`💳 Custom order paid: ${String(data.title)}`,lastSenderId:user.uid},{merge:true}); await db.collection("conversations").doc(conversationId).collection("messages").add({senderId:user.uid,text:`💳 Payment confirmed — custom order #${n} is now in progress.`,orderId:orderRef.id,createdAt:FieldValue.serverTimestamp()});}
 return NextResponse.json({ok:true,orderId:orderRef.id});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
