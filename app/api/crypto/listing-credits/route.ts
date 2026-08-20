import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";
import {publicError,userFromRequest} from "@/lib/server";
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
  const duplicate=await db.collection("listingCreditCryptoPayments").where("txHashNormalized","==",hash.toLowerCase()).limit(1).get();
  if(!duplicate.empty)return NextResponse.json({error:"This transaction hash has already been used."},{status:409});

  const sellerId=user.uid;
  let coveredListingIds:string[]=[];
  let creditsAdded=0;
  await db.runTransaction(async tx=>{
    const freshPayment=await tx.get(paymentRef);
    if(!freshPayment.exists||String(freshPayment.data()?.status)!=="awaiting-crypto-payment")throw new Error("Payment is no longer available.");
    const sellerListings=await tx.get(db.collection("listings").where("sellerId","==",sellerId).limit(100));
    const eligible=sellerListings.docs.filter(d=>d.data().status==="awaiting-listing-fee").sort((a,b)=>a.id===String(payment.listingId)?-1:b.id===String(payment.listingId)?1:0).slice(0,PACK_SIZE);
    coveredListingIds=eligible.map(d=>d.id);
    creditsAdded=PACK_SIZE-coveredListingIds.length;
    tx.set(paymentRef,{status:"payment-submitted",txHash:hash,txHashNormalized:hash.toLowerCase(),submittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),creditsAdded,coveredListingIds},{merge:true});
    const userRef=db.collection("users").doc(sellerId);
    tx.set(userRef,{listingCredits:FieldValue.increment(creditsAdded),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    eligible.forEach(d=>tx.set(d.ref,{status:"pending-approval",feeCoveredBy:"crypto-credit-pack",listingFeePaidAmount:PRICE,listingFeePaidCurrency:String(payment.currency),listingCreditsPurchased:PACK_SIZE,listingFeePaymentId:id,listingFeePaidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true}));
  });

  await notifyUser({userId:sellerId,type:"listing_credits_paid",eventId:id,title:"Listing credits submitted",message:`Your ${PRICE} ${String(payment.currency)} payment was submitted. ${PACK_SIZE} listing slots are covered and the payment is awaiting verification.`,link:"/?services=1"});
  for(const listingId of coveredListingIds){const ref=db.collection("listings").doc(listingId),snap=await ref.get(),data=snap.data()||{};if(!snap.exists)continue;await notifyAdmin({subject:`Listing approval required: ${String(data.title||"Paid service")}`,heading:"Crypto-paid service awaiting approval",message:"A seller submitted the listing-credit crypto payment. Verify the transaction before final approval.",details:{Title:String(data.title||"Service"),Seller:user.email||sellerId,Category:String(data.category||""),Subcategory:String(data.subcategory||""),"Listing ID":listingId,"Payment":"2 USDT or 2 USDC","Transaction":hash},actionLabel:"Review listing",actionPath:"/admin"});}
  return NextResponse.json({ok:true,status:"payment-submitted",creditsAdded,coveredListingIds});
}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
