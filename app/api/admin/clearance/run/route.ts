import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";
import {notifyUser} from "@/lib/notifications";
import {publicError,userFromRequest} from "@/lib/server";

const FEE=.05;

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
        // Stage 1 -> Stage 2: the buyer's delivery-length review window has closed with no dispute.
        // Start the standard five-day clearance countdown now.
        const reviewEnd=o.disputeWindowEndsAt?.toDate?.()||new Date(o.disputeWindowEndsAt||0);
        if(!reviewEnd.getTime()||reviewEnd.getTime()>now)continue;
        let sellerId="",buyerId="";
        await db.runTransaction(async tx=>{
          const fresh=await tx.get(d.ref),x=fresh.data()||{};
          if(x.clearanceEndsAt||x.disputeStatus==="open"||x.disputed===true)return;
          sellerId=String(x.sellerId||"");
          buyerId=String(x.buyerId||"");
          tx.set(d.ref,{clearanceStartsAt:FieldValue.serverTimestamp(),clearanceEndsAt:new Date(now+5*24*60*60*1000),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        });
        if(sellerId){
          advanced++;
          const number=String(o.orderNumber||d.id);
          await notifyUser({userId:sellerId,type:"order_review_window_passed",eventId:`${d.id}_clearance_started`,title:`Order #${number} entered clearance`,message:"The buyer review window closed with no dispute. Your earnings are now in the standard five-day clearance period.",link:"/?seller=1",email:true});
          if(buyerId)await notifyUser({userId:buyerId,type:"order_review_window_passed",eventId:`${d.id}_clearance_started_buyer`,title:`Order #${number} entered clearance`,message:"Your review window has closed. The order is now in the standard five-day clearance period before the seller is paid.",link:`/?order=${d.id}`});
        }
        continue;
      }

      // Stage 2 -> release: the five-day clearance has ended, release seller earnings.
      const end=o.clearanceEndsAt?.toDate?.()||new Date(o.clearanceEndsAt||0);
      if(!end.getTime()||end.getTime()>now||o.releasedAt||o.releasedEarly)continue;

      let sellerId="",gross=0,net=0;
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(d.ref),x=fresh.data()||{};
        if(x.releasedAt||x.releasedEarly||x.disputeStatus==="open"||x.disputed===true)return;
        sellerId=String(x.sellerId||"");
        gross=Math.max(0,Number(x.sellerEarnings??x.sellerAmount??(x.totalCents!=null?Number(x.totalCents)/100:0)));
        const fee=Number((gross*FEE).toFixed(2));
        net=Number((gross-fee).toFixed(2));
        const sr=db.collection("users").doc(sellerId),ss=await tx.get(sr),s=ss.data()||{},balance=Math.max(0,Number(s.balance||s.availableBalance||s.sellerBalance||0)),withdrawable=Math.max(0,Number(s.withdrawableBalance??s.releasedEarnings??balance));
        tx.set(sr,{balance:Number((balance+gross).toFixed(2)),availableBalance:Number((balance+gross).toFixed(2)),sellerBalance:Number((balance+gross).toFixed(2)),withdrawableBalance:Number((withdrawable+net).toFixed(2)),releasedEarnings:Number((withdrawable+net).toFixed(2)),lastReleasedGross:gross,lastReleasedWithdrawalFee:fee,lastReleasedNet:net,withdrawalFeePercent:5,updatedAt:FieldValue.serverTimestamp()},{merge:true});
        tx.set(d.ref,{status:"completed",clearanceStatus:"released",releasedAt:FieldValue.serverTimestamp(),releasedBy:"automatic",releasedGross:gross,releasedWithdrawalFee:fee,releasedNet:net,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
      if(sellerId){
        await notifyUser({userId:sellerId,type:"earnings_released",eventId:`${d.id}_automatic_release`,title:"Five-day clearance completed",message:`Your ${gross.toFixed(2)} earnings were automatically released. ${net.toFixed(2)} is available for withdrawal after the 5% withdrawal fee.`,link:"/?seller=1",email:true});
        released++;
      }
    }

    return NextResponse.json({ok:true,released,advanced,checked:snap.size,intervalSeconds:10});
  }catch(e){
    const x=publicError(e);
    return NextResponse.json({error:x.message},{status:x.status});
  }
}
