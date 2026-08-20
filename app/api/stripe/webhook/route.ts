import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { required } from "@/lib/server";
import { notifyAdmin } from "@/lib/admin-notifications";
import { notifyAdminInApp, notifyUser } from "@/lib/notifications";

export const runtime="nodejs";
const money=(cents:number)=>`€${(Number(cents||0)/100).toFixed(2)}`;

export async function POST(req:NextRequest){
  const stripe=new Stripe(required("STRIPE_SECRET_KEY"));let event:Stripe.Event;
  try{event=stripe.webhooks.constructEvent(await req.text(),req.headers.get("stripe-signature")??"",required("STRIPE_WEBHOOK_SECRET"));}
  catch{return NextResponse.json({error:"Invalid signature"},{status:400});}
  if(event.type==="checkout.session.completed"){
    const session=event.data.object,orderId=session.metadata?.orderId;
    if(session.metadata?.type==="listing-credit-pack"){
      const listingId=String(session.metadata.listingId||""),sellerId=String(session.metadata.sellerId||""),purchaseRef=db.collection("listingCreditPurchases").doc(session.id),listingRef=db.collection("listings").doc(listingId),userRef=db.collection("users").doc(sellerId);
      await db.runTransaction(async tx=>{const [purchase,listing,sellerListings]=await Promise.all([tx.get(purchaseRef),tx.get(listingRef),tx.get(db.collection("listings").where("sellerId","==",sellerId).limit(100))]);if(purchase.exists)return;if(!listing.exists||String(listing.data()?.sellerId)!==sellerId)throw new Error("Listing credit payment does not match seller");const coveredListings=sellerListings.docs.filter(document=>document.data().status==="awaiting-listing-fee").sort((a,b)=>a.id===listingId?-1:b.id===listingId?1:0).slice(0,5),creditsAdded=5-coveredListings.length;tx.set(purchaseRef,{sellerId,listingId,amountCents:100,creditsPurchased:5,creditsAdded,coveredListingIds:coveredListings.map(document=>document.id),stripeSessionId:session.id,stripePaymentIntent:session.payment_intent,createdAt:FieldValue.serverTimestamp()});tx.set(userRef,{listingCredits:FieldValue.increment(creditsAdded),updatedAt:FieldValue.serverTimestamp()},{merge:true});coveredListings.forEach(document=>tx.set(document.ref,{status:"pending-approval",feeCoveredBy:"credit-pack",listingFeePaidCents:100,listingCreditsPurchased:5,listingFeePaidAt:FieldValue.serverTimestamp(),stripeListingFeeSessionId:session.id,updatedAt:FieldValue.serverTimestamp()},{merge:true}));});
      const purchase=(await purchaseRef.get()).data()||{};
      await notifyUser({userId:sellerId,type:"listing_credits_paid",eventId:session.id,title:"Listing credits purchased",message:"Your listing-credit payment was received. Your eligible listings are now queued for administrator approval.",link:"/?services=1",email:true});
      for(const coveredId of Array.isArray(purchase.coveredListingIds)?purchase.coveredListingIds:[]){const coveredRef=db.collection("listings").doc(String(coveredId)),covered=await coveredRef.get(),data=covered.data()||{};if(!covered.exists||data.adminNotificationSentAt)continue;const sent=await notifyAdmin({subject:`Listing approval required: ${String(data.title||"New service")}`,heading:"Paid listing awaiting approval",message:"The seller completed the listing-credit payment and this service is ready for administrator review.",details:{Title:data.title||"New service","Seller ID":sellerId,Category:data.category||"",Subcategory:data.subcategory||"","Listing ID":covered.id,"Stripe payment":"Confirmed"},actionLabel:"Review listing",actionPath:"/admin"});if(sent)await coveredRef.set({adminNotificationSentAt:FieldValue.serverTimestamp()},{merge:true});}
      return NextResponse.json({received:true});
    }
    if(orderId && session.payment_status === "paid"){
      await db.runTransaction(async tx=>{const orderRef=db.collection("orders").doc(orderId),counterRef=db.collection("counters").doc("orders");const [order,counter]=await Promise.all([tx.get(orderRef),tx.get(counterRef)]);if(!order.exists)throw new Error("Order not found");if(order.data()?.status==="paid")return;const number=Number(counter.data()?.next??1);tx.set(counterRef,{next:number+1},{merge:true});tx.update(orderRef,{orderNumber:number,status:"paid",paidAt:new Date(),disputeDeadline:new Date(Date.now()+5*86400000),stripePaymentIntent:session.payment_intent,invoiceEmailStatus:"pending"});});
      const orderRef=db.collection("orders").doc(orderId),order=(await orderRef.get()).data();
      if(order?.orderNumber){
        await notifyUser({userId:String(order.buyerId),type:"order_paid",eventId:orderRef.id,title:`Order #${order.orderNumber} confirmed`,message:`Your payment of ${money(Number(order.totalCents||0))} was received. Your order is now active.`,link:`/?order=${orderRef.id}`,email:true});
        await notifyUser({userId:String(order.sellerId),type:"order_received",eventId:orderRef.id,title:`New order #${order.orderNumber}`,message:`You received a new order. Your seller earnings for this order are ${money(Number(order.sellerNetCents ?? order.serviceCents ?? 0))}; the buyer fee is charged separately.`,link:`/?order=${orderRef.id}`,email:true});
        await notifyAdminInApp({type:"order_received",eventId:orderRef.id,title:`New order #${order.orderNumber}`,message:`A buyer paid ${money(Number(order.totalCents||0))}. Seller earnings are ${money(Number(order.sellerNetCents ?? order.serviceCents ?? 0))}.`,link:"/admin"});
      }
      if(order?.orderNumber&&!order.invoiceEmailSentAt){
        const [buyerSnap,sellerSnap,listingSnap]=await Promise.all([db.collection("users").doc(String(order.buyerId)).get(),db.collection("users").doc(String(order.sellerId)).get(),db.collection("listings").doc(String(order.listingId)).get()]);
        const buyer=buyerSnap.data()||{},seller=sellerSnap.data()||{},listing=listingSnap.data()||{},pack=Array.isArray(listing.packages)?listing.packages[Number(order.packageIndex||0)]:null;
        const buyerName=[buyer.firstName,buyer.lastName].filter(Boolean).join(" ")||String(buyer.email||"Customer"),sellerName=[seller.firstName,seller.lastName].filter(Boolean).join(" ")||"SaharaSnow seller",appUrl=required("APP_URL");
        const html=`<div style="font-family:Arial,sans-serif;color:#17154a;max-width:680px;margin:auto;padding:24px"><header style="display:flex;align-items:center;gap:12px"><img src="${appUrl}/logo.png" alt="SaharaSnow" width="72" height="72" style="object-fit:contain"><h1>SaharaSnow</h1></header><hr style="border:0;border-top:1px solid #e9e5df"><h2>Invoice #${order.orderNumber}</h2><p><b>Order number:</b> ${order.orderNumber}</p><p><b>Customer:</b> ${buyerName}</p><p><b>Seller:</b> ${sellerName}</p><p><b>Service:</b> ${String(listing.title||"SaharaSnow service")}</p><p><b>Package:</b> ${String(pack?.name||"Selected package")}</p><table style="width:100%;border-collapse:collapse;margin-top:28px"><tr><td style="padding:12px;border-bottom:1px solid #eee">Service amount</td><td align="right">${money(order.serviceCents)}</td></tr><tr><td style="padding:12px;border-bottom:1px solid #eee">Buyer fee (4%)</td><td align="right">${money(order.buyerFeeCents)}</td></tr><tr><td style="padding:14px 12px;font-size:18px"><b>Total paid</b></td><td align="right" style="font-size:18px"><b>${money(order.totalCents)}</b></td></tr></table><p>You have five days from payment to open a dispute.</p><p><a href="${appUrl}/?order=${orderId}" style="display:inline-block;background:#ff6f61;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:bold">View order and invoice</a></p></div>`;
        if(buyer.email){const result=await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(buyer.email),subject:`SaharaSnow invoice #${order.orderNumber} — ${String(listing.title||"Your order")}`,html});if(result.error){await orderRef.set({invoiceEmailStatus:"failed",invoiceEmailError:result.error.message},{merge:true});throw new Error(result.error.message);}await orderRef.set({invoiceEmailStatus:"sent",invoiceEmailSentAt:FieldValue.serverTimestamp()},{merge:true});}
        if(seller.email)await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(seller.email),subject:`New SaharaSnow order #${order.orderNumber}`,html:`<div style="font-family:Arial,sans-serif;color:#17154a"><img src="${appUrl}/logo.png" width="65" alt="SaharaSnow"><h1>You received a new order</h1><p><b>${String(listing.title||"Service")}</b></p><p>Order #${order.orderNumber} · ${money(order.serviceCents)}</p><p>Sign in to SaharaSnow to review the order.</p></div>`});
      }
    }
  }
  return NextResponse.json({received:true});
}
