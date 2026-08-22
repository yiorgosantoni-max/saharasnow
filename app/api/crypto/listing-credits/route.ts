import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";
import {publicError,userFromRequest} from "@/lib/server";
import {findBingXDepositByHash} from "@/lib/bingx-readonly";
import {notifyAdmin} from "@/lib/admin-notifications";
import {notifyUser} from "@/lib/notifications";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const PACK_SIZE=5;
const PRICE=2;
const USDT_TRC20_ADDRESS="TKX1h9L4wWjimF8UVWHQLtFYvWv7TTHdnB";
const USDC_BEP20_ADDRESS="0x3edce5a73b0a04822108de0e0894eed10987a71a";
const QR_BASE="https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=";
const METHODS={
  usdt:{currency:"USDT",network:"Tron (TRC20)",address:USDT_TRC20_ADDRESS},
  usdc:{currency:"USDC",network:"BNB Smart Chain (BEP20)",address:USDC_BEP20_ADDRESS},
} as const;
type Method=keyof typeof METHODS;

async function assertAdmin(req:NextRequest){
  const user=await userFromRequest(req);
  const allowed=String(process.env.SUPER_ADMIN_EMAIL||process.env.ADMIN_EMAIL||"").toLowerCase();
  const email=String(user.email||"").toLowerCase();
  if(!allowed||email!==allowed)throw new Error("Administrator access required.");
  return user;
}

export async function POST(req:NextRequest){try{
  const user=await userFromRequest(req);
  const {listingId,paymentMethod="usdt"}=await req.json();
  const id=String(listingId||"");
  const method=String(paymentMethod) as Method;
  if(!id)return NextResponse.json({error:"A listing is required."},{status:400});
  if(!(method in METHODS))return NextResponse.json({error:"Choose USDT or USDC."},{status:400});
  const listingRef=db.collection("listings").doc(id),listingSnap=await listingRef.get();
  if(!listingSnap.exists)return NextResponse.json({error:"Listing not found."},{status:404});
  const listing=listingSnap.data()||{};
  if(String(listing.sellerId)!==user.uid)return NextResponse.json({error:"You can only pay for your own listing."},{status:403});
  if(String(listing.status)!=="awaiting-listing-fee")return NextResponse.json({error:"This listing does not require a listing-credit payment."},{status:400});
  const payment=METHODS[method];
  const paymentRef=db.collection("listingCreditCryptoPayments").doc();
  await paymentRef.set({sellerId:user.uid,listingId:id,paymentMethod:method,currency:payment.currency,network:payment.network,depositAddress:payment.address,amount:PRICE,creditsPurchased:PACK_SIZE,status:"awaiting-crypto-payment",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  await listingRef.set({listingCreditPaymentId:paymentRef.id,listingCreditPaymentMethod:method,listingCreditPaymentCurrency:payment.currency,listingCreditPaymentAmount:PRICE,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return NextResponse.json({paymentId:paymentRef.id,listingId:id,amount:PRICE,credits:PACK_SIZE,currency:payment.currency,network:payment.network,depositAddress:payment.address,qrCodeUrl:`${QR_BASE}${encodeURIComponent(payment.address)}`});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PUT(req:NextRequest){try{
  const user=await userFromRequest(req);
  const {paymentId,txHash}=await req.json();
  const id=String(paymentId||""),hash=String(txHash||"").trim();
  if(!id||hash.length<16)return NextResponse.json({error:"Enter a valid blockchain transaction hash."},{status:400});
  const paymentRef=db.collection("listingCreditCryptoPayments").doc(id),paymentSnap=await paymentRef.get();
  if(!paymentSnap.exists)return NextResponse.json({error:"Payment request not found."},{status:404});
  const payment=paymentSnap.data()||{};
  if(String(payment.sellerId)!==user.uid)return NextResponse.json({error:"Forbidden"},{status:403});
  if(String(payment.status)!=="awaiting-crypto-payment")return NextResponse.json({error:"This payment has already been submitted."},{status:400});
  const normalized=hash.toLowerCase();
  const duplicate=await db.collection("listingCreditCryptoPayments").where("txHashNormalized","==",normalized).limit(1).get();
  if(!duplicate.empty)return NextResponse.json({error:"This transaction hash has already been used."},{status:409});

  await paymentRef.set({status:"payment-submitted",txHash:hash,txHashNormalized:normalized,submittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});

  await notifyUser({userId:user.uid,type:"listing_credits_submitted",eventId:id,title:"Listing credit payment submitted",message:`Your ${PRICE} ${String(payment.currency)} payment was submitted and is now awaiting administrator verification against the blockchain. Your listing slots will be unlocked once the transaction is confirmed.`,link:"/?services=1"});
  await notifyAdmin({subject:`Listing credit payment awaiting verification: ${PRICE} ${String(payment.currency)}`,heading:"Listing-credit crypto payment submitted",message:"A seller submitted a transaction hash for the listing-credit pack. Verify it against BingX before any listing credits are granted.",details:{Seller:user.email||user.uid,Amount:`${PRICE} ${String(payment.currency)}`,Transaction:hash,"Payment ID":id},actionLabel:"Review payment",actionPath:"/admin/crypto"});
  return NextResponse.json({ok:true,status:"payment-submitted"});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function GET(req:NextRequest){try{
  await assertAdmin(req);
  const status=req.nextUrl.searchParams.get("status")||"payment-submitted";
  const statuses=status==="admin"?["payment-submitted","approved","rejected"]:[status];
  const results=await Promise.all(statuses.map(s=>db.collection("listingCreditCryptoPayments").where("status","==",s).limit(200).get()));
  const docs=results.flatMap(r=>r.docs);
  docs.sort((a,b)=>(b.data().submittedAt?.seconds||0)-(a.data().submittedAt?.seconds||0));
  return NextResponse.json({payments:docs.map(d=>({id:d.id,...d.data()}))});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PATCH(req:NextRequest){try{
  const admin=await assertAdmin(req);
  const {paymentId,action}=await req.json();
  const id=String(paymentId||""),act=String(action||"");
  if(!id||!["approve","reject"].includes(act))return NextResponse.json({error:"Invalid request."},{status:400});
  const paymentRef=db.collection("listingCreditCryptoPayments").doc(id);
  const snap=await paymentRef.get();
  if(!snap.exists)return NextResponse.json({error:"Payment not found."},{status:404});
  const payment=snap.data()||{};
  if(String(payment.status)!=="payment-submitted")return NextResponse.json({error:"This payment is not awaiting verification."},{status:400});

  if(act==="reject"){
    await paymentRef.set({status:"rejected",rejectedAt:FieldValue.serverTimestamp(),rejectedBy:admin.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    if(payment.sellerId)await notifyUser({userId:String(payment.sellerId),type:"listing_credits_rejected",eventId:id,title:"Listing credit payment rejected",message:`Your ${PRICE} ${String(payment.currency)} payment could not be verified and was rejected. Please submit a valid transaction hash.`,link:"/?services=1"});
    return NextResponse.json({ok:true,status:"rejected"});
  }

  const currency=String(payment.currency||"USDT").toUpperCase() as "USDT"|"USDC";
  const hash=String(payment.txHashNormalized||payment.txHash||"").trim().toLowerCase();
  if(!hash)return NextResponse.json({error:"Transaction hash is missing."},{status:400});
  const match=await findBingXDepositByHash(hash,[currency==="USDC"?"USDC":"USDT",currency==="USDC"?"USDT":"USDC"]);
  if(!match)return NextResponse.json({error:"BingX could not find an incoming USDT/USDC deposit with this exact transaction hash. The payment cannot be approved until the hashes match."},{status:400});
  const matchedAmount=Number(match.amount||0);
  if(!Number.isFinite(matchedAmount)||Math.abs(matchedAmount-PRICE)>0.000001)return NextResponse.json({error:`BingX hash matched, but the amount does not match. Expected ${PRICE} ${currency}; BingX reports ${matchedAmount} ${String(match.coin||currency)}.`},{status:400});
  if(String(match.coin||"").toUpperCase()!==currency)return NextResponse.json({error:`BingX hash matched, but the currency does not match. Expected ${currency}.`},{status:400});

  const sellerId=String(payment.sellerId||"");
  let coveredListingIds:string[]=[];
  let creditsAdded=0;
  await db.runTransaction(async tx=>{
    const fresh=await tx.get(paymentRef);
    if(!fresh.exists||String(fresh.data()?.status)!=="payment-submitted")throw new Error("This payment is no longer awaiting verification.");
    const sellerListings=await tx.get(db.collection("listings").where("sellerId","==",sellerId).limit(100));
    const eligible=sellerListings.docs.filter(d=>d.data().status==="awaiting-listing-fee").sort((a,b)=>a.id===String(payment.listingId)?-1:b.id===String(payment.listingId)?1:0).slice(0,PACK_SIZE);
    coveredListingIds=eligible.map(d=>d.id);
    creditsAdded=PACK_SIZE-coveredListingIds.length;
    tx.set(paymentRef,{status:"approved",approvedAt:FieldValue.serverTimestamp(),approvedBy:admin.uid,bingxVerified:true,bingxTxId:String(match.txId||hash),bingxMatchedAmount:matchedAmount,creditsAdded,coveredListingIds,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    const userRef=db.collection("users").doc(sellerId);
    tx.set(userRef,{listingCredits:FieldValue.increment(creditsAdded),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    eligible.forEach(d=>tx.set(d.ref,{status:"pending-approval",feeCoveredBy:"crypto-credit-pack",listingFeePaidAmount:PRICE,listingFeePaidCurrency:currency,listingCreditsPurchased:PACK_SIZE,listingFeePaymentId:id,listingFeePaidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true}));
  });

  if(sellerId)await notifyUser({userId:sellerId,type:"listing_credits_approved",eventId:id,title:"Listing credits confirmed",message:`Your ${PRICE} ${currency} payment was verified against the blockchain. ${PACK_SIZE} listing slots are now covered and awaiting administrator content approval.`,link:"/?services=1"});
  for(const listingId of coveredListingIds){
    const ref=db.collection("listings").doc(listingId),listingSnap=await ref.get(),data=listingSnap.data()||{};
    if(!listingSnap.exists)continue;
    await notifyAdmin({subject:`Listing approval required: ${String(data.title||"Paid service")}`,heading:"Crypto-paid service awaiting approval",message:"The listing-credit crypto payment was verified against BingX. Review the listing content before final approval.",details:{Title:String(data.title||"Service"),Seller:sellerId,Category:String(data.category||""),Subcategory:String(data.subcategory||""),"Listing ID":listingId},actionLabel:"Review listing",actionPath:"/admin"});
  }
  return NextResponse.json({ok:true,status:"approved",creditsAdded,coveredListingIds,bingxVerified:true});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
