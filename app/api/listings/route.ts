import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";
import { notifyAdmin } from "@/lib/admin-notifications";
import { notifyUser } from "@/lib/notifications";

const MIN_SERVICE_PRICE_CENTS = 500;
const FREE_LISTING_LIMIT = 3;
const LISTING_CREDIT_PACK_SIZE = 5;
const LISTING_CREDIT_PACK_PRICE = 2;

const packageSchema = z.object({
  name: z.string().min(1).max(30),
  priceCents: z.number().int().min(MIN_SERVICE_PRICE_CENTS),
  description: z.string().min(10).max(1000),
  deliveryDays: z.number().int().min(1).max(90),
  revisions: z.number().int().min(-1).max(10),
});
const videoUrlSchema = z.union([z.string().url(), z.literal("")]).optional();
const schema = z.object({
  title: z.string().min(10).max(100), description: z.string().min(50).max(5000), category: z.string().min(2), subcategory: z.string().min(2).max(100),
  tags: z.array(z.string().min(1).max(30)).max(5).default([]), requirements: z.string().max(2000).default(""), priceCents: z.number().int().min(MIN_SERVICE_PRICE_CENTS),
  deliveryDays: z.number().int().min(1).max(90), revisions: z.number().int().min(-1).max(10), photoUrls: z.array(z.string().url()).max(2), videoUrl: videoUrlSchema,
  packages: z.array(packageSchema).min(1).max(3),
});
const editSchema = schema.omit({ category: true, subcategory: true });

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = schema.parse(await req.json());
    const ref = db.collection("listings").doc();
    const userRef = db.collection("users").doc(user.uid);
    let status = "pending-approval";
    let listingFeeRequired = false;
    let listingCreditBalance = 0;
    let feeCoveredBy = "free";

    await db.runTransaction(async (tx) => {
      const [profile, existing] = await Promise.all([
        tx.get(userRef),
        tx.get(db.collection("listings").where("sellerId", "==", user.uid).limit(100)),
      ]);
      const profileData = profile.data() || {};
      if (!String(profileData.firstName || "").trim() || !String(profileData.lastName || "").trim() || !String(profileData.country || "").trim()) throw new Error("Complete and save your first name, surname and country before creating a service.");
      const existingCount = existing.docs.filter((document) => document.data().status !== "deleted").length;
      let freeListingsUsed = Number(profileData.freeListingsUsed);
      if (!Number.isFinite(freeListingsUsed)) freeListingsUsed = Math.min(existingCount, FREE_LISTING_LIMIT - 1);
      let credits = Math.max(0, Number(profileData.listingCredits || 0));
      if (freeListingsUsed < FREE_LISTING_LIMIT) { freeListingsUsed++; feeCoveredBy = "free"; }
      else if (credits > 0) { credits--; feeCoveredBy = "credit"; }
      else { status = "awaiting-listing-fee"; listingFeeRequired = true; feeCoveredBy = "awaiting-credit-pack"; }
      listingCreditBalance = credits;
      tx.set(ref, {...body, currency:"usd", sellerId:user.uid, status, listingFeeRequired, listingFeeAmount: listingFeeRequired ? LISTING_CREDIT_PACK_PRICE : 0, listingFeeCurrencyOptions: listingFeeRequired ? ["USDT","USDC"] : [], listingCreditPackSize: listingFeeRequired ? LISTING_CREDIT_PACK_SIZE : 0, feeCoveredBy, createdAt:FieldValue.serverTimestamp(), renewAt:new Date(Date.now()+365*86400000)});
      tx.set(userRef, {freeListingsUsed, listingCredits:credits, updatedAt:FieldValue.serverTimestamp()}, {merge:true});
    });

    if (status === "pending-approval") {
      await notifyAdmin({subject:`Listing approval required: ${body.title}`, heading:"New service awaiting approval", message:"A seller submitted a service that is ready for administrator review.", details:{Title:body.title, Seller:user.email||user.uid, Category:body.category, Subcategory:body.subcategory, "Listing ID":ref.id}, actionLabel:"Review listing", actionPath:"/admin"});
      await notifyUser({userId:user.uid, type:"listing_submitted", eventId:ref.id, title:"Listing submitted", message:`Your listing “${body.title}” was submitted and is waiting for administrator approval.`, link:"/?services=1"});
    } else if (status === "awaiting-listing-fee") {
      await notifyUser({userId:user.uid, type:"listing_fee_required", eventId:ref.id, title:"3 free listings used", message:`Your first ${FREE_LISTING_LIMIT} listings are free. Pay ${LISTING_CREDIT_PACK_PRICE} USDT or ${LISTING_CREDIT_PACK_PRICE} USDC to unlock ${LISTING_CREDIT_PACK_SIZE} more listings.`, link:`/listing-credits?listing=${encodeURIComponent(ref.id)}`});
    }
    return NextResponse.json({id:ref.id, status, listingFeeRequired, listingCreditBalance, currency:"usd", freeListingLimit:FREE_LISTING_LIMIT, listingCreditPackSize:LISTING_CREDIT_PACK_SIZE, listingCreditPackPrice:LISTING_CREDIT_PACK_PRICE, listingCreditPaymentMethods:["USDT","USDC"]});
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({error:"Listing data is invalid. Minimum service and package price is $5.00."}, {status:400});
    const x = publicError(e); return NextResponse.json({error:x.message}, {status:x.status});
  }
}

export async function GET(req:NextRequest){try{const mine=req.nextUrl.searchParams.get("mine")==="1";let snap;if(mine){const user=await userFromRequest(req);snap=await db.collection("listings").where("sellerId","==",user.uid).limit(100).get();}else snap=await db.collection("listings").where("status","==","active").limit(100).get();const visibleDocs=mine?snap.docs.filter(document=>document.data().status!=="deleted"):snap.docs,results=await Promise.all(visibleDocs.map(async document=>{const listing=document.data();const source=mine&&listing.pendingEdit&&typeof listing.pendingEdit==="object"?{...listing,...(listing.pendingEdit as Record<string,unknown>)}:listing;let sellerName="",sellerCountry="",sellerProfileImage="";if(listing.sellerId){const seller=(await db.collection("users").doc(String(listing.sellerId)).get()).data()||{};sellerName=[seller.firstName,seller.lastName].map(value=>String(value||"").trim()).filter(Boolean).join(" ");sellerCountry=String(seller.country||"").trim();sellerProfileImage=String(seller.profileImageUrl||"");}if(!mine&&(!sellerName||!sellerCountry))return null;const packages=Array.isArray(source.packages)?source.packages.map((p:unknown)=>typeof p==="object"&&p?{...(p as Record<string,unknown>),priceCents:Math.max(MIN_SERVICE_PRICE_CENTS,Number((p as Record<string,unknown>).priceCents)||MIN_SERVICE_PRICE_CENTS)}:p):source.packages;return {id:document.id,...source,pendingEditStatus:listing.pendingEditStatus||null,priceCents:Math.max(MIN_SERVICE_PRICE_CENTS,Number(source.priceCents)||MIN_SERVICE_PRICE_CENTS),packages,currency:"usd",sellerName:sellerName||"Profile incomplete",sellerCountry,sellerProfileImage};})),listings=results.filter(Boolean);return NextResponse.json({listings,currency:"usd",minimumServicePriceCents:MIN_SERVICE_PRICE_CENTS});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function PUT(req:NextRequest){try{const user=await userFromRequest(req),id=req.nextUrl.searchParams.get("id")?.trim();if(!id||id.length>200)return NextResponse.json({error:"A valid listing ID is required."},{status:400});const raw=await req.json();if(raw&&typeof raw==="object"&&!("videoUrl" in raw))(raw as Record<string,unknown>).videoUrl="";const body=editSchema.parse(raw),ref=db.collection("listings").doc(id),snapshot=await ref.get();if(!snapshot.exists)return NextResponse.json({error:"Listing not found."},{status:404});const existing=snapshot.data()||{};if(String(existing.sellerId||"")!==user.uid)return NextResponse.json({error:"You can only edit your own listings."},{status:403});if(existing.status==="deleted")return NextResponse.json({error:"Deleted listings cannot be edited."},{status:400});const pendingEdit={...body,currency:"usd",submittedAt:new Date().toISOString(),submittedBy:user.uid};await ref.set({pendingEdit,pendingEditStatus:"pending-approval",pendingEditSubmittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),lastEditedBy:user.uid,lastEditedAt:FieldValue.serverTimestamp()},{merge:true});await db.collection("auditLogs").add({actorUid:user.uid,actorEmail:user.email||"",resource:"listing",resourceId:id,action:"seller-edit-submitted",note:`Seller submitted edits for listing “${String(existing.title||id)}”.`,createdAt:FieldValue.serverTimestamp()});await notifyAdmin({subject:`Listing edit approval required: ${String(existing.title||id)}`,heading:"Seller changes awaiting approval",message:"The currently approved listing remains live. Review the pending changes before publishing them.",details:{Title:String(existing.title||"Service"),Seller:user.email||user.uid,Category:String(existing.category||""),Subcategory:String(existing.subcategory||""),"Listing ID":id},actionLabel:"Review listing",actionPath:"/admin"});await notifyUser({userId:user.uid,type:"listing_edit_submitted",eventId:id,title:"Listing changes submitted",message:"Your listing changes are waiting for administrator approval. Your current approved version remains live until then.",link:"/?services=1"});return NextResponse.json({ok:true,id,currency:"usd",pendingApproval:true});}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:"Listing data is invalid. Categories cannot be changed and minimum service and package price is $5.00."},{status:400});const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function DELETE(req:NextRequest){try{const user=await userFromRequest(req);const id=req.nextUrl.searchParams.get("id")?.trim();if(!id||id.length>200)return NextResponse.json({error:"A valid listing ID is required."},{status:400});const ref=db.collection("listings").doc(id);const snapshot=await ref.get();if(!snapshot.exists)return NextResponse.json({error:"Listing not found."},{status:404});const listing=snapshot.data()||{};if(String(listing.sellerId||"")!==user.uid)return NextResponse.json({error:"You can only delete your own listings."},{status:403});if(listing.status==="deleted")return NextResponse.json({ok:true});await ref.set({status:"deleted",deletedAt:FieldValue.serverTimestamp(),deletedBy:user.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});await db.collection("auditLogs").add({actorUid:user.uid,actorEmail:user.email||"",resource:"listing",resourceId:id,action:"seller-delete",createdAt:FieldValue.serverTimestamp()});return NextResponse.json({ok:true});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}