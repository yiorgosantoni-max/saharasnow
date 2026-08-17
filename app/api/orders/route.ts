import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { notifyAdminInApp, notifyUser } from "@/lib/notifications";
import { publicError, releaseEligibleSellerOrders, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const disputeSchema = z.object({orderId:z.string().min(1),reason:z.string().trim().min(10).max(3000)});
const dateValue=(value:unknown)=>value&&typeof value==="object"&&"toDate" in value&&typeof (value as {toDate?:unknown}).toDate==="function"?(value as {toDate:()=>Date}).toDate().toISOString():value instanceof Date?value.toISOString():null;

export async function GET(req:NextRequest){
  try{
    const user=await userFromRequest(req);
    await releaseEligibleSellerOrders(user.uid);
    const [buyer,seller]=await Promise.all([
      db.collection("orders").where("buyerId","==",user.uid).limit(200).get(),
      db.collection("orders").where("sellerId","==",user.uid).limit(200).get()
    ]);
    const docs=[...buyer.docs,...seller.docs.filter(d=>!buyer.docs.some(b=>b.id===d.id))];
    const orders=await Promise.all(docs.map(async doc=>{const data=doc.data();const listing=(await db.collection("listings").doc(String(data.listingId||"")).get()).data()||{};return {id:doc.id,...data,title:String(listing.title||"Service"),createdAt:dateValue(data.createdAt),paidAt:dateValue(data.paidAt),disputeDeadline:dateValue(data.disputeDeadline),isBuyer:String(data.buyerId)===user.uid};}));
    orders.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    return NextResponse.json({orders});
  }catch(error){const x=publicError(error);return NextResponse.json({error:x.message},{status:x.status});}
}

export async function POST(req:NextRequest){
  try{
    const user=await userFromRequest(req),body=disputeSchema.parse(await req.json());
    const ref=db.collection("orders").doc(body.orderId),snap=await ref.get();
    if(!snap.exists)return NextResponse.json({error:"Order not found."},{status:404});
    const order=snap.data()||{};
    if(String(order.buyerId)!==user.uid)return NextResponse.json({error:"Only the buyer can open a dispute."},{status:403});
    const deadline=order.disputeDeadline&&typeof order.disputeDeadline.toDate==="function"?order.disputeDeadline.toDate():order.disputeDeadline instanceof Date?order.disputeDeadline:new Date(0);
    if(Date.now()>deadline.getTime())return NextResponse.json({error:"The five-day dispute window has expired."},{status:400});
    if(["disputed","refunded","completed-released"].includes(String(order.status)))return NextResponse.json({error:"This order is already resolved or has an active dispute."},{status:400});
    await ref.set({status:"disputed",disputeStatus:"open",disputeReason:body.reason,disputeOpenedBy:user.uid,disputeOpenedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    await notifyUser({userId:String(order.sellerId),type:"dispute_opened",eventId:body.orderId,title:`Dispute opened for order #${String(order.orderNumber||body.orderId)}`,message:`The buyer opened a dispute. The order is now held for administrator review.`,link:`/?order=${body.orderId}`,email:true});
    await notifyUser({userId:user.uid,type:"dispute_opened",eventId:body.orderId,title:`Dispute opened for order #${String(order.orderNumber||body.orderId)}`,message:"Your dispute was submitted to the administrator. Seller funds remain held while it is reviewed.",link:`/?order=${body.orderId}`});
    await notifyAdminInApp({type:"dispute_opened",eventId:body.orderId,title:"New order dispute",message:`A buyer opened a dispute for order #${String(order.orderNumber||body.orderId)}.`,link:"/admin"});
    return NextResponse.json({ok:true});
  }catch(error){const x=publicError(error);return NextResponse.json({error:x.message},{status:x.status});}
}
