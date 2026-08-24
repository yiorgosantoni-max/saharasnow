import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { resolveCryptoDeposit } from "@/lib/crypto-deposit";
import { notifyUser } from "@/lib/notifications";
import { orderNumberFor, publicError,required,userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const actionSchema=z.object({offerId:z.string().min(1),action:z.enum(["accept","reject"])});

export async function GET(req:NextRequest){
  try{
    const user=await userFromRequest(req);
    const [sent,received]=await Promise.all([
      db.collection("customOrders").where("senderId","==",user.uid).limit(100).get(),
      db.collection("customOrders").where("recipientId","==",user.uid).limit(100).get()
    ]);
    const seen=new Set<string>();
    const offers=[...sent.docs,...received.docs].filter(d=>{if(seen.has(d.id))return false;seen.add(d.id);return true}).map(d=>{
      const data=d.data()||{};
      const createdAt=data.createdAt&&typeof data.createdAt==="object"&&"toDate" in data.createdAt?(data.createdAt as {toDate:()=>Date}).toDate().toISOString():null;
      return {id:d.id,senderId:String(data.senderId||""),recipientId:String(data.recipientId||""),title:String(data.title||""),details:String(data.details||""),price:Number(data.price||0),currency:data.currency==="USDC"?"USDC":"USDT",status:String(data.status||"sent"),createdAt};
    }).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
    return NextResponse.json({offers});
  }catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}
}

export async function POST(req:NextRequest){try{const user=await userFromRequest(req),b=await req.json();const recipientId=String(b.recipientId||""),title=String(b.title||"").trim(),details=String(b.details||"").trim(),price=Math.max(0,Number(b.price||0)),currency=b.currency==="USDC"?"USDC":"USDT",attachments=Array.isArray(b.attachments)?b.attachments.slice(0,5):[];if(!recipientId||!title||!details||!price)throw Error("Recipient, title, details and price are required.");const conversationId=[user.uid,recipientId].sort().join("_");const conversationSnap=await db.collection("conversations").doc(conversationId).get();if(!conversationSnap.exists)throw Error("Custom offers can only be sent to users you have already messaged.");const messageSnap=await conversationSnap.ref.collection("messages").limit(1).get();if(messageSnap.empty)throw Error("Custom offers can only be sent after you have communicated with this user.");const [senderSnap,recipientSnap]=await Promise.all([db.collection("users").doc(user.uid).get(),db.collection("users").doc(recipientId).get()]);if(!recipientSnap.exists)throw Error("Recipient not found.");const sender=senderSnap.data()||{},recipient=recipientSnap.data()||{},senderName=[sender.firstName,sender.lastName].filter(Boolean).join(" ")||String(sender.username||"SaharaSnow user"),recipientName=[recipient.firstName,recipient.lastName].filter(Boolean).join(" ")||String(recipient.username||"SaharaSnow user");const ref=db.collection("customOrders").doc();await ref.set({senderId:user.uid,recipientId,title,details,price,currency,attachments,status:"sent",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),participantIds:[user.uid,recipientId]});await notifyUser({userId:recipientId,type:"custom_order",eventId:ref.id,title:"Custom offer received",message:`${senderName} sent you a custom offer: ${title}`,link:"/?custom-orders=1"});await notifyUser({userId:user.uid,type:"custom_order_sent",eventId:`${ref.id}_sent`,title:"Custom offer sent",message:`Your custom offer "${title}" was sent to ${recipientName}.`,link:"/?custom-orders=1"});if(recipient.email){try{const app=required("APP_URL");await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(recipient.email),subject:"Custom offer received on SaharaSnow",html:`<h1>Custom offer received</h1><p>Hello ${String(recipient.firstName||"there")},</p><p>${senderName} sent you a custom offer for <b>${title}</b>.</p><p><b>${price.toFixed(2)} ${currency}</b></p><p>${details}</p><p>Open your inbox on SaharaSnow to accept or reject this offer.</p><p><a href="${app}/?custom-orders=1">View custom offer</a></p>`});}catch{}}if(sender.email){try{const app=required("APP_URL");await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(sender.email),subject:"Your custom offer was sent on SaharaSnow",html:`<h1>Custom offer sent</h1><p>Hello ${String(sender.firstName||"there")},</p><p>Your custom offer for <b>${title}</b> (${price.toFixed(2)} ${currency}) was sent to ${recipientName}. You'll be notified by email as soon as they accept or reject it.</p><p><a href="${app}/?custom-orders=1">View custom offer</a></p>`});}catch{}}return NextResponse.json({ok:true,id:ref.id});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PATCH(req:NextRequest){
  try{
    const user=await userFromRequest(req);
    const body=actionSchema.parse(await req.json());
    const offerRef=db.collection("customOrders").doc(body.offerId);
    const offerSnap=await offerRef.get();
    if(!offerSnap.exists)return NextResponse.json({error:"Custom offer not found."},{status:404});
    const offer=offerSnap.data()||{};
    if(String(offer.recipientId)!==user.uid)return NextResponse.json({error:"Only the recipient of this offer can accept or reject it."},{status:403});
    if(String(offer.status||"sent")!=="sent")return NextResponse.json({error:"This custom offer has already been actioned."},{status:400});

    const senderId=String(offer.senderId||"");
    const title=String(offer.title||"Custom order");
    const details=String(offer.details||"");
    const price=Number(offer.price||0);
    const currency:"USDT"|"USDC"=offer.currency==="USDC"?"USDC":"USDT";
    const [senderSnap,recipientSnap]=await Promise.all([db.collection("users").doc(senderId).get(),db.collection("users").doc(user.uid).get()]);
    const sender=senderSnap.data()||{},recipient=recipientSnap.data()||{};
    const senderName=[sender.firstName,sender.lastName].filter(Boolean).join(" ")||String(sender.username||"SaharaSnow user");
    const recipientName=[recipient.firstName,recipient.lastName].filter(Boolean).join(" ")||String(recipient.username||"SaharaSnow user");

    if(body.action==="reject"){
      await offerRef.set({status:"rejected",updatedAt:FieldValue.serverTimestamp()},{merge:true});
      await notifyUser({userId:senderId,type:"custom_order_rejected",eventId:`${body.offerId}_rejected`,title:"Custom offer rejected",message:`${recipientName} declined your custom offer "${title}".`,link:"/?custom-orders=1"});
      if(sender.email){try{await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(sender.email),subject:"Your custom offer was declined",html:`<h1>Custom offer declined</h1><p>Hello ${String(sender.firstName||"there")},</p><p>${recipientName} declined your custom offer for <b>${title}</b>.</p>`});}catch{}}
      return NextResponse.json({ok:true,status:"rejected"});
    }

    const amountCents=Math.max(1,Math.round(price*100));
    const {network,address:depositAddress}=resolveCryptoDeposit(currency);
    if(!depositAddress)return NextResponse.json({error:"USDC payments are not configured yet. Add USDC_SOLANA_DEPOSIT_ADDRESS in the server environment."},{status:503});
    // Accepting turns the offer into a first-class order using the same shape
    // /api/crypto/checkout creates for a marketplace listing purchase. That
    // means the standard crypto-payment + BingX verification pipeline (and
    // the admin CRYPTO dashboard), delivery, revisions, disputes and the
    // automatic clearance/release cron all apply to it with no extra code.
    const orderRef=db.collection("orders").doc();
    const paymentOrderNumber=orderNumberFor(orderRef.id,currency);

    await db.runTransaction(async tx=>{
      const fresh=await tx.get(offerRef);
      if(String((fresh.data()||{}).status||"sent")!=="sent")throw new Error("This custom offer has already been actioned.");
      tx.set(offerRef,{status:"accepted",orderId:orderRef.id,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      tx.create(orderRef,{buyerId:user.uid,sellerId:senderId,listingId:"",title,packageName:"Custom offer",packageDeliveryDays:7,orderNumber:paymentOrderNumber,serviceCents:amountCents,sellerNetCents:amountCents,buyerFeeCents:0,platformFeeCents:0,checkoutTotalCents:amountCents,totalCents:amountCents,currency:"USD",paymentCurrency:currency,network,depositAddress,paymentMethod:currency==="USDT"?"usdt-trc20":"usdc-bep20",status:"awaiting-crypto-payment",isCustomOrder:true,customOfferId:body.offerId,customOfferDetails:details,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    });

    await notifyUser({userId:senderId,type:"custom_order_accepted",eventId:`${body.offerId}_accepted`,title:"Custom offer accepted",message:`${recipientName} accepted your custom offer "${title}" (order #${paymentOrderNumber}). Payment is now pending.`,link:"/?custom-orders=1"});
    await notifyUser({userId:user.uid,type:"custom_order_accepted_buyer",eventId:`${body.offerId}_accepted_buyer`,title:"Custom offer accepted",message:`You accepted the custom offer "${title}" (order #${paymentOrderNumber}). Send ${(amountCents/100).toFixed(2)} ${currency} to complete the order.`,link:"/?custom-orders=1"});
    if(sender.email){try{await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(sender.email),subject:"Your custom offer was accepted",html:`<h1>Custom offer accepted</h1><p>Hello ${String(sender.firstName||"there")},</p><p>${recipientName} accepted your custom offer for <b>${title}</b> — order #${paymentOrderNumber}. They are now completing payment of ${(amountCents/100).toFixed(2)} ${currency}.</p>`});}catch{}}
    if(recipient.email){try{const app=required("APP_URL");await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(recipient.email),subject:"Complete payment for your accepted custom offer",html:`<h1>Complete your payment</h1><p>Hello ${String(recipient.firstName||"there")},</p><p>You accepted the custom offer <b>${title}</b> from ${senderName} — order #${paymentOrderNumber}. Send exactly <b>${(amountCents/100).toFixed(2)} ${currency}</b> on <b>${network}</b> to complete the order.</p><p><a href="${app}/?inbox=1">Open your inbox to pay</a></p>`});}catch{}}

    return NextResponse.json({ok:true,status:"accepted",orderId:orderRef.id,orderNumber:paymentOrderNumber,amountCents,currency,network,depositAddress});
  }catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}
}
