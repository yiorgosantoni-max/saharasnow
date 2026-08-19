import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {db} from "@/lib/firebase-admin";
import {publicError,userFromRequest} from "@/lib/server";
export const runtime="nodejs";export const dynamic="force-dynamic";
const actionSchema=z.object({invoiceId:z.string().min(1),action:z.enum(["confirm","reject","release"]),note:z.string().trim().max(1000).default(""),source:z.enum(["invoice","order"]).optional()});
async function assertAdmin(req:NextRequest){const token=await userFromRequest(req);const email=String(token.email||"").toLowerCase(),allowed=String(process.env.SUPER_ADMIN_EMAIL||process.env.ADMIN_EMAIL||"").toLowerCase();if(!allowed||email!==allowed)throw new Error("FORBIDDEN");return token;}
const serial=(x:any,source:"invoice"|"order")=>({id:x.id,...x.data(),source});
const cryptoMethods=new Set(["crypto-usdt-trc20","usdt-trc20","usdc-bep20"]);

export async function GET(req:NextRequest){try{await assertAdmin(req);const [invoices,ordersPending,ordersPaid]=await Promise.all([
  db.collection("customInvoices").where("status","==","payment-submitted").limit(200).get(),
  db.collection("orders").where("status","==","payment-submitted").limit(200).get(),
  db.collection("orders").where("status","==","paid").limit(200).get()
]);
return NextResponse.json({payments:[...invoices.docs.map(d=>serial(d,"invoice")),...ordersPending.docs.filter(d=>cryptoMethods.has(String(d.data()?.paymentMethod||""))).map(d=>serial(d,"order")),...ordersPaid.docs.filter(d=>cryptoMethods.has(String(d.data()?.paymentMethod||""))).map(d=>serial(d,"order"))]});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PATCH(req:NextRequest){try{const admin=await assertAdmin(req),body=actionSchema.parse(await req.json()),source=body.source||"invoice",collection=source==="order"?"orders":"customInvoices",ref=db.collection(collection).doc(body.invoiceId);let result:any={};await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error("NOT_FOUND");const row=snap.data()||{};const status=String(row.status||"");
  if(body.action==="release"){
    if(source!=="order"||!cryptoMethods.has(String(row.paymentMethod||"")))throw new Error("Only crypto service orders can be released here.");
    if(status!=="paid")throw new Error("Confirm the crypto payment before releasing it to the seller.");
    const sellerId=String(row.sellerId||"");
    const net=Math.max(0,Math.round(Number(row.sellerNetCents??row.serviceCents??row.totalCents??0)));
    if(!sellerId||net<=0)throw new Error("Invalid seller or release amount.");
    const ledgerRef=db.collection("balanceTransactions").doc(`crypto-release-${body.invoiceId}`);
    if((await tx.get(ledgerRef)).exists)throw new Error("This order has already been released.");
    tx.set(db.collection("users").doc(sellerId),{availableBalanceCents:FieldValue.increment(net),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    tx.set(ledgerRef,{userId:sellerId,type:"crypto-order-release",amountCents:net,currency:String(row.paymentCurrency||"USDT"),orderId:body.invoiceId,txHash:String(row.txHash||""),status:"released",createdAt:FieldValue.serverTimestamp(),confirmedBy:admin.uid});
    tx.set(ref,{status:"completed-released",releasedAt:FieldValue.serverTimestamp(),releasedBy:admin.uid,releaseNote:body.note,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    result={action:"release",sellerId,amountCents:net};return;
  }
  if(status!=="payment-submitted")throw new Error("This payment is no longer awaiting confirmation.");
  if(body.action==="reject"){tx.set(ref,{status:"payment-rejected",adminNote:body.note,reviewedBy:admin.uid,reviewedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});result={action:"reject"};return;}
  if(source==="order"){tx.set(ref,{status:"paid",paidAt:FieldValue.serverTimestamp(),paymentConfirmedBy:admin.uid,adminNote:body.note,updatedAt:FieldValue.serverTimestamp()},{merge:true});result={action:"confirm"};return;}
  const buyerId=String(row.buyerId||""),amountCents=Math.max(0,Math.round(Number(row.amountCents||0)));if(!buyerId||!amountCents)throw new Error("Invalid payment record.");const buyerRef=db.collection("users").doc(buyerId),buyerSnap=await tx.get(buyerRef);if(!buyerSnap.exists)throw new Error("BUYER_NOT_FOUND");const ledgerRef=db.collection("balanceTransactions").doc(body.invoiceId);if(await tx.get(ledgerRef).then(x=>x.exists))throw new Error("This payment has already been credited.");tx.set(buyerRef,{availableBalanceCents:FieldValue.increment(amountCents),updatedAt:FieldValue.serverTimestamp()},{merge:true});tx.set(ledgerRef,{userId:buyerId,type:"crypto-stablecoin-deposit",amountCents,currency:String(row.paymentCurrency||"USDT"),invoiceId:body.invoiceId,txHash:String(row.txHash||""),status:"confirmed",createdAt:FieldValue.serverTimestamp(),confirmedBy:admin.uid});tx.set(ref,{status:"payment-confirmed",balanceCredited:true,adminNote:body.note,reviewedBy:admin.uid,reviewedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});result={action:"confirm"};});return NextResponse.json({ok:true,...result});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
