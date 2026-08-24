import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const OPEN_DISPUTE_STATUSES=new Set(["open","pending","active","under-review","disputed"]);
const cryptoMethods=new Set(["crypto-usdt-trc20","usdt-trc20","usdc-bep20","usdc-solana"]);

function authorized(req:NextRequest){
  const secret=String(process.env.CRON_SECRET||"");
  if(secret)return req.headers.get("authorization")===`Bearer ${secret}`;
  return req.headers.get("x-vercel-cron")==="1";
}
async function hasOpenDispute(orderId:string,row:any){
  if(String(row.status||"").toLowerCase()==="disputed"||OPEN_DISPUTE_STATUSES.has(String(row.disputeStatus||"").toLowerCase()))return true;
  const snap=await db.collection("disputes").where("orderId","==",orderId).limit(20).get().catch(()=>({docs:[]} as any));
  return snap.docs.some((d:any)=>OPEN_DISPUTE_STATUSES.has(String(d.data()?.status||"").toLowerCase()));
}

export async function GET(req:NextRequest){
  if(!authorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
  const now=Date.now();let released=0,skipped=0;
  const snap=await db.collection("orders").where("status","==","crypto-received").limit(500).get();
  for(const doc of snap.docs){
    const row=doc.data();
    if(!cryptoMethods.has(String(row.paymentMethod||"")))continue;
    const releaseAt=row.releaseAfterAt?.toDate?.()||new Date(row.releaseAfterAt||0);
    if(!(releaseAt instanceof Date)||Number.isNaN(releaseAt.getTime())||releaseAt.getTime()>now)continue;
    if(await hasOpenDispute(doc.id,row)){skipped++;continue;}
    try{
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(doc.ref);if(!fresh.exists)throw new Error("NOT_FOUND");const current=fresh.data()||{};
        if(String(current.status)!=="crypto-received")return;
        const sellerId=String(current.sellerId||"");const net=Math.max(0,Math.round(Number(current.sellerNetCents??current.serviceCents??current.totalCents??0)));if(!sellerId||net<=0)throw new Error("INVALID_RELEASE");
        const currency=String(current.paymentCurrency||"USDT").toUpperCase();if(currency!=="USDT"&&currency!=="USDC")throw new Error("INVALID_CURRENCY");
        const ledgerRef=db.collection("balanceTransactions").doc(`crypto-release-${doc.id}`);if((await tx.get(ledgerRef)).exists){tx.set(doc.ref,{status:"completed-released",releasedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});return;}
        const balanceField=currency==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
        tx.set(db.collection("users").doc(sellerId),{[balanceField]:FieldValue.increment(net),availableBalanceCents:FieldValue.increment(net),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        tx.set(ledgerRef,{userId:sellerId,type:"crypto-order-release",amountCents:net,currency,orderId:doc.id,txHash:String(current.txHash||""),status:"released",createdAt:FieldValue.serverTimestamp(),releasedBy:"system-3-day-window"});
        tx.set(doc.ref,{status:"completed-released",releasedAt:FieldValue.serverTimestamp(),releasedBy:"system-3-day-window",updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
      released++;
    }catch{skipped++;}
  }
  return NextResponse.json({ok:true,released,skipped,checked:snap.size});
}
