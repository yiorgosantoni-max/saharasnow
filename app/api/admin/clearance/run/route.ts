import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";
import {notifyUser} from "@/lib/notifications";
import {publicError,userFromRequest} from "@/lib/server";

async function isAdmin(req:NextRequest){
  const u=await userFromRequest(req),p=(await db.collection("users").doc(u.uid).get()).data()||{};
  if(p.role!=="admin"&&String(u.email||"").toLowerCase()!=="yiorgosantoni@gmail.com")throw Error("Administrator access required.");
  return u;
}

export async function POST(req:NextRequest){
  try{
    await isAdmin(req);
    const snap=await db.collection("orders").where("status","==","delivered").limit(200).get(),now=Date.now();
    let released=0,advanced=0;

    for(const d of snap.docs){
      const o=d.data()||{};
      if(o.disputeStatus==="open"||o.disputed===true)continue;

      if(!o.clearanceEndsAt){
        // Stage 1 -> Stage 2: the buyer's three-day review window has closed with no dispute.
        // Start the standard one-day clearance countdown now.
        const reviewEnd=o.disputeWindowEndsAt?.toDate?.()||new Date(o.disputeWindowEndsAt||0);
        if(!reviewEnd.getTime()||reviewEnd.getTime()>now)continue;
        let sellerId="",buyerId="";
        await db.runTransaction(async tx=>{
          const fresh=await tx.get(d.ref),x=fresh.data()||{};
          if(x.clearanceEndsAt||x.disputeStatus==="open"||x.disputed===true)return;
          sellerId=String(x.sellerId||"");
          buyerId=String(x.buyerId||"");
          tx.set(d.ref,{clearanceStartsAt:FieldValue.serverTimestamp(),clearanceEndsAt:new Date(now+1*24*60*60*1000),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        });
        if(sellerId){
          advanced++;
          const number=String(o.orderNumber||d.id);
          await notifyUser({userId:sellerId,type:"order_review_window_passed",eventId:`${d.id}_clearance_started`,title:`Order #${number} entered clearance`,message:"The buyer review window closed with no dispute. Your earnings are now in the standard one-day clearance period.",link:"/?seller=1",email:true});
          if(buyerId)await notifyUser({userId:buyerId,type:"order_review_window_passed",eventId:`${d.id}_clearance_started_buyer`,title:`Order #${number} entered clearance`,message:"Your review window has closed. The order is now in the standard one-day clearance period before the seller is paid.",link:`/?order=${d.id}`});
        }
        continue;
      }

      // Stage 2 -> release: the one-day clearance has ended. Release the seller's full
      // net earnings now, in the order's own currency (USDT/USDC), with no fee taken here.
      // The 5% withdrawal fee is only ever deducted later, when the seller actually
      // requests a withdrawal (see app/api/withdrawals/route.ts) — never at release time.
      const end=o.clearanceEndsAt?.toDate?.()||new Date(o.clearanceEndsAt||0);
      if(!end.getTime()||end.getTime()>now||o.releasedAt||o.releasedEarly)continue;

      let sellerId="",netCents=0,currency="";
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(d.ref),x=fresh.data()||{};
        if(x.releasedAt||x.releasedEarly||x.disputeStatus==="open"||x.disputed===true)return;
        const ledgerRef=db.collection("balanceTransactions").doc(`clearance-release-${d.id}`);
        if((await tx.get(ledgerRef)).exists){
          tx.set(d.ref,{status:"completed-released",clearanceStatus:"released",releasedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
          return;
        }
        sellerId=String(x.sellerId||"");
        netCents=Math.max(0,Math.round(Number(x.sellerNetCents??x.serviceCents??x.totalCents??0)));
        currency=String(x.paymentCurrency||"USDT").toUpperCase();
        if(!sellerId||netCents<=0)return;
        const balanceField=currency==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
        tx.set(db.collection("users").doc(sellerId),{[balanceField]:FieldValue.increment(netCents),availableBalanceCents:FieldValue.increment(netCents),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        tx.set(ledgerRef,{userId:sellerId,type:"clearance-release",amountCents:netCents,currency,orderId:d.id,status:"released",createdAt:FieldValue.serverTimestamp(),releasedBy:"automatic-one-day-clearance"});
        tx.set(d.ref,{status:"completed-released",clearanceStatus:"released",releasedAt:FieldValue.serverTimestamp(),releasedBy:"automatic",releasedNetCents:netCents,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
      if(sellerId&&netCents>0){
        const netAmount=(netCents/100).toFixed(2);
        await notifyUser({userId:sellerId,type:"earnings_released",eventId:`${d.id}_automatic_release`,title:"One-day clearance completed",message:`Your ${netAmount} ${currency} was automatically released to your available balance. The 5% fee is only deducted when you request a withdrawal.`,link:"/?seller=1",email:true});
        released++;
      }
    }

    return NextResponse.json({ok:true,released,advanced,checked:snap.size,intervalSeconds:10});
  }catch(e){
    const x=publicError(e);
    return NextResponse.json({error:x.message},{status:x.status});
  }
}
