import {NextRequest,NextResponse}from"next/server";
import {FieldValue}from"firebase-admin/firestore";
import {z}from"zod";
import {db}from"@/lib/firebase-admin";
import {publicError,userFromRequest}from"@/lib/server";
import {notifyUser}from"@/lib/notifications";

const bodySchema=z.object({orderId:z.string().min(1)});

export async function POST(req:NextRequest){
  try{
    const adminUser=await userFromRequest(req);
    const admin=(await db.collection("users").doc(adminUser.uid).get()).data()||{};
    if(admin.role!=="admin"&&String(admin.email||adminUser.email||"").toLowerCase()!=="yiorgosantoni@gmail.com")return NextResponse.json({error:"Administrator access required."},{status:403});
    const {orderId}=bodySchema.parse(await req.json());
    const orderRef=db.collection("orders").doc(orderId);
    let sellerId="",netCents=0,currency="",cryptoPaymentId="";
    await db.runTransaction(async tx=>{
      const snap=await tx.get(orderRef);
      if(!snap.exists)throw new Error("Order not found.");
      const order=snap.data()||{};
      if(order.releasedEarly===true||String(order.clearanceStatus||"").toLowerCase()==="released")throw new Error("These seller earnings have already been released.");
      sellerId=String(order.sellerId||"");
      cryptoPaymentId=String(order.cryptoPaymentId||"");
      netCents=Math.max(0,Math.round(Number(order.sellerNetCents??order.serviceCents??order.totalCents??0)));
      currency=String(order.paymentCurrency||"USDT").toUpperCase();
      if(!sellerId)throw new Error("Order seller not found.");
      if(netCents<=0)throw new Error("Invalid order earnings amount.");
      const ledgerRef=db.collection("balanceTransactions").doc(`clearance-release-${orderId}`);
      if((await tx.get(ledgerRef)).exists)throw new Error("These seller earnings have already been released.");
      const balanceField=currency==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
      tx.set(db.collection("users").doc(sellerId),{[balanceField]:FieldValue.increment(netCents),availableBalanceCents:FieldValue.increment(netCents),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      tx.set(ledgerRef,{userId:sellerId,type:"clearance-release",amountCents:netCents,currency,orderId,status:"released",createdAt:FieldValue.serverTimestamp(),releasedBy:adminUser.uid});
      tx.set(orderRef,{status:"completed-released",clearanceStatus:"released",releasedEarly:true,releasedAt:FieldValue.serverTimestamp(),releasedBy:adminUser.uid,releasedNetCents:netCents,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      if(cryptoPaymentId)tx.set(db.collection("cryptoPayments").doc(cryptoPaymentId),{releasedEarly:true,releasedAt:FieldValue.serverTimestamp(),releasedBy:adminUser.uid},{merge:true});
    });
    const netAmount=(netCents/100).toFixed(2);
    await notifyUser({userId:sellerId,type:"earnings_released_early",eventId:orderId,title:"Earnings released early",message:`An administrator released your earnings of ${netAmount} ${currency} early to your available balance. The 5% fee is only deducted when you request a withdrawal.`,link:"/?seller=1",email:true});
    return NextResponse.json({ok:true,orderId,netCents,currency});
  }catch(e){
    const x=e instanceof z.ZodError?{message:"Invalid release request.",status:400}:publicError(e);
    return NextResponse.json({error:x.message},{status:x.status});
  }
}
