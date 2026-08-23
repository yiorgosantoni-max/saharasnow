import {FieldValue}from"firebase-admin/firestore";
import {NextRequest,NextResponse}from"next/server";
import {z}from"zod";
import {db}from"@/lib/firebase-admin";
import {notifyAdminInApp,notifyUser}from"@/lib/notifications";
import {postSystemMessage}from"@/lib/messaging";
import {publicError,userFromRequest}from"@/lib/server";
export const runtime="nodejs";
const schema=z.object({orderId:z.string().min(1)});
export async function POST(req:NextRequest){try{
  const user=await userFromRequest(req),body=schema.parse(await req.json());
  const ref=db.collection("orders").doc(body.orderId);
  let sellerId="",netCents=0,currency="";
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists)throw Error("Order not found.");
    const order=snap.data()||{};
    if(String(order.buyerId)!==user.uid)throw Error("Only the buyer can accept this order.");
    if(String(order.status)!=="delivered")throw Error("This order is not awaiting acceptance.");
    if(order.disputeStatus==="open"||order.disputed===true)throw Error("This order has an open dispute.");
    sellerId=String(order.sellerId||"");
    netCents=Math.max(0,Math.round(Number(order.sellerNetCents??order.serviceCents??order.totalCents??0)));
    currency=String(order.paymentCurrency||"USDT").toUpperCase();
    if(!sellerId||netCents<=0)throw Error("Invalid order earnings amount.");
    const ledgerRef=db.collection("balanceTransactions").doc(`clearance-release-${body.orderId}`);
    if((await tx.get(ledgerRef)).exists)throw Error("These seller earnings have already been released.");
    const balanceField=currency==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
    tx.set(db.collection("users").doc(sellerId),{[balanceField]:FieldValue.increment(netCents),availableBalanceCents:FieldValue.increment(netCents),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.set(ledgerRef,{userId:sellerId,type:"clearance-release",amountCents:netCents,currency,orderId:body.orderId,status:"released",createdAt:FieldValue.serverTimestamp(),releasedBy:"buyer-accepted"});
    tx.set(ref,{status:"completed-released",clearanceStatus:"released",releasedAt:FieldValue.serverTimestamp(),releasedBy:"buyer-accepted",releasedNetCents:netCents,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  });
  const netAmount=(netCents/100).toFixed(2);
  const orderSnap=await ref.get(),order=orderSnap.data()||{},number=String(order.orderNumber||body.orderId);
  await notifyUser({userId:sellerId,type:"order_accepted",eventId:`${body.orderId}_accepted`,title:`Order #${number} accepted by buyer`,message:`The buyer accepted the delivery early. Your ${netAmount} ${currency} was released immediately to your available balance.`,link:"/?seller=1",email:true});
  await notifyUser({userId:user.uid,type:"order_accepted",eventId:`${body.orderId}_accepted_buyer`,title:`Order #${number} completed`,message:"You accepted the delivery and the order is now complete.",link:`/?order=${body.orderId}`});
  await notifyAdminInApp({type:"order_accepted",eventId:body.orderId,title:`Order #${number} accepted by buyer`,message:"The buyer accepted delivery early and seller earnings were released immediately.",link:"/admin"});
  if(sellerId)await postSystemMessage({buyerId:user.uid,sellerId,orderId:body.orderId,text:`✅ Order #${number} accepted. Payment has been released to the seller.`});
  return NextResponse.json({ok:true});
}catch(e){const x=e instanceof z.ZodError?{message:"Invalid request.",status:400}:publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
