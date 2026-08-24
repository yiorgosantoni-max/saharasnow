import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { userFromRequest } from "@/lib/server";
import { notifyUser } from "@/lib/notifications";

const ADMIN_EMAIL=(process.env.SUPER_ADMIN_EMAIL||"yiorgosantoni@gmail.com").toLowerCase();
async function requireAdmin(req:NextRequest){const user=await userFromRequest(req);if((user.email||"").toLowerCase()!==ADMIN_EMAIL)throw new Error("ADMIN_FORBIDDEN");return user;}
const schema=z.object({reviewId:z.string().min(1),action:z.enum(["delete","reset"]),note:z.string().trim().max(500).optional(),collection:z.enum(["reviews","buyerReviews"]).default("reviews")});

async function recalculateSeller(sellerId:string){const snap=await db.collection("reviews").where("sellerId","==",sellerId).get();let count=0,sum=0;snap.forEach(doc=>{const rating=Number(doc.data().rating);if(Number.isFinite(rating)&&rating>=1&&rating<=5){count++;sum+=rating;}});await db.collection("users").doc(sellerId).set({reviewCount:count,reviewRatingSum:sum,averageRating:count?sum/count:0,updatedAt:FieldValue.serverTimestamp()},{merge:true});return {count,sum};}
async function recalculateBuyer(buyerId:string){const snap=await db.collection("buyerReviews").where("buyerId","==",buyerId).get();let count=0,sum=0;snap.forEach(doc=>{const rating=Number(doc.data().rating);if(Number.isFinite(rating)&&rating>=1&&rating<=5){count++;sum+=rating;}});await db.collection("users").doc(buyerId).set({buyerReviewCount:count,buyerReviewRatingSum:sum,buyerAverageRating:count?sum/count:0,updatedAt:FieldValue.serverTimestamp()},{merge:true});return {count,sum};}

export async function GET(req:NextRequest){
  try{
    await requireAdmin(req);
    const [reviewsSnap,buyerReviewsSnap]=await Promise.all([
      db.collection("reviews").get(),
      db.collection("buyerReviews").get()
    ]);
    const reviews=reviewsSnap.docs.map(d=>({id:d.id,...d.data()}));
    const buyerFeedback=buyerReviewsSnap.docs.map(d=>({id:d.id,...d.data()}));
    return NextResponse.json({reviews,buyerFeedback});
  }catch{return NextResponse.json({error:"Only the SaharaSnow administrator can access review moderation."},{status:403});}
}

export async function PATCH(req:NextRequest){
  try{
    const admin=await requireAdmin(req);
    const body=schema.parse(await req.json());
    const ref=db.collection(body.collection).doc(body.reviewId);
    const snap=await ref.get();
    if(!snap.exists)return NextResponse.json({error:"Review not found"},{status:404});
    const review=snap.data()||{};
    const orderId=String(review.orderId||"");
    const sellerId=String(review.sellerId||"");
    const buyerId=String(review.buyerId||"");
    if(!orderId||(body.collection==="reviews"&&!sellerId)||(body.collection==="buyerReviews"&&!buyerId))return NextResponse.json({error:"Review is missing seller, buyer or order information"},{status:400});
    if(body.action==="reset"&&!body.note?.trim())return NextResponse.json({error:"Enter a reason when requesting a review change."},{status:400});
    await ref.delete();
    const totals=body.collection==="reviews"?await recalculateSeller(sellerId):await recalculateBuyer(buyerId);
    if(body.action==="reset"){
      if(body.collection==="reviews"&&buyerId){
        await notifyUser({userId:buyerId,type:"review_change_requested",eventId:orderId,title:"Review change requested",message:`The SaharaSnow administrator requested that you submit your review again${body.note?`: ${body.note}`:"."}`,link:`/review/${orderId}`,email:true});
      }else if(body.collection==="buyerReviews"&&sellerId){
        await notifyUser({userId:sellerId,type:"feedback_change_requested",eventId:orderId,title:"Buyer feedback change requested",message:`The SaharaSnow administrator requested that you submit your feedback about this buyer again${body.note?`: ${body.note}`:"."}`,link:`/review/${orderId}`,email:true});
      }
    }
    await db.collection("auditLogs").add({adminUid:admin.uid,adminEmail:admin.email||ADMIN_EMAIL,resource:body.collection==="reviews"?"review":"buyerFeedback",resourceId:body.reviewId,action:body.action,note:body.note||"",sellerId,orderId,buyerId,createdAt:FieldValue.serverTimestamp()});
    return NextResponse.json({ok:true,deleted:true,reviewReset:body.action==="reset",rating:totals});
  }catch(e){
    const message=e instanceof Error?e.message:"Unable to moderate review";
    return NextResponse.json({error:message==="ADMIN_FORBIDDEN"?"Only the SaharaSnow administrator can moderate reviews.":message==="Review not found"?message:"Unable to moderate review."},{status:message==="ADMIN_FORBIDDEN"?403:400});
  }
}
