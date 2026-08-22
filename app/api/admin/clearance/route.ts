import {NextRequest,NextResponse}from"next/server";
import {FieldValue}from"firebase-admin/firestore";
import {db}from"@/lib/firebase-admin";
import {publicError,userFromRequest}from"@/lib/server";

async function admin(req:NextRequest){
  const u=await userFromRequest(req),p=(await db.collection("users").doc(u.uid).get()).data()||{};
  if(p.role!=="admin"&&String(u.email||"").toLowerCase()!=="yiorgosantoni@gmail.com")throw Error("Administrator access required.");
  return u;
}

export async function POST(req:NextRequest){
  try{
    const u=await admin(req),body=await req.json(),orderId=String(body.orderId||"");
    if(!orderId)throw Error("Order ID required.");
    const ref=db.collection("orders").doc(orderId);
    let sellerId="",netCents=0,currency="";
    await db.runTransaction(async tx=>{
      const s=await tx.get(ref);
      if(!s.exists)throw Error("Order not found.");
      const o=s.data()||{};
      if(o.status!=="delivered"||o.releasedEarly||o.releasedAt)throw Error("Order is not awaiting automatic clearance.");
      const end=o.clearanceEndsAt?.toDate?.()||new Date(o.clearanceEndsAt||0);
      if(Date.now()<end.getTime())throw Error("The five-day clearance period has not ended.");
      if(o.disputeStatus==="open"||o.disputed===true)throw Error("This order has an open dispute.");
      sellerId=String(o.sellerId||"");
      netCents=Math.max(0,Math.round(Number(o.sellerNetCents??o.serviceCents??o.totalCents??0)));
      currency=String(o.paymentCurrency||"USDT").toUpperCase();
      if(!sellerId||netCents<=0)throw Error("Invalid order earnings amount.");
      const ledgerRef=db.collection("balanceTransactions").doc(`clearance-release-${orderId}`);
      if((await tx.get(ledgerRef)).exists)throw Error("These seller earnings have already been released.");
      const balanceField=currency==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
      tx.set(db.collection("users").doc(sellerId),{[balanceField]:FieldValue.increment(netCents),availableBalanceCents:FieldValue.increment(netCents),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      tx.set(ledgerRef,{userId:sellerId,type:"clearance-release",amountCents:netCents,currency,orderId,status:"released",releasedBy:"automatic"});
      tx.set(ref,{status:"completed-released",clearanceStatus:"released",releasedAt:FieldValue.serverTimestamp(),releasedBy:"automatic",releasedNetCents:netCents,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    });
    return NextResponse.json({ok:true,orderId,netCents,currency,releasedBy:u.uid});
  }catch(e){
    const x=publicError(e);
    return NextResponse.json({error:x.message},{status:x.status});
  }
}
