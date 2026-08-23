import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { userFromRequest } from "@/lib/server";
import { notifyUser } from "@/lib/notifications";

const ADMIN_EMAIL=(process.env.SUPER_ADMIN_EMAIL||"yiorgosantoni@gmail.com").toLowerCase();
async function requireAdmin(req:NextRequest){const user=await userFromRequest(req);if((user.email||"").toLowerCase()!==ADMIN_EMAIL)throw new Error("ADMIN_FORBIDDEN");return user;}
const schema=z.object({reviewId:z.string().min(1),reviewType:z.enum(["seller","buyer"]).default("seller"),action:z.enum(["delete","reset","edit"]),note:z.string().trim().max(500).optional(),rating:z.number().int().min(1).max(5).optional(),text:z.string().trim().min(5).max(2000).optional()});

async function recalculateSeller(sellerId:string){const snap=await db.collection("reviews").where("sellerId","==",sellerId).get();let count=0,sum=0;snap.forEach(doc=>{const rating=Number(doc.data().rating);if(Number.isFinite(rating)&&rating>=1&&rating<=5){count++;sum+=rating;}});await db.collection("users").doc(sellerId).set({reviewCount:count,reviewRatingSum:sum,averageRating:count?sum/count:0,updatedAt:FieldValue.serverTimestamp()},{merge:true});return {count,sum};}
async function recalculateBuyer(buyerId:string){const snap=await db.collection("buyerReviews").where("buyerId","==",buyerId).get();let count=0,sum=0;snap.forEach(doc=>{const rating=Number(doc.data().rating);if(Number.isFinite(rating)&&rating>=1&&rating<=5){count++;sum+=rating;}});await db.collection("users").doc(buyerId).set({buyerReviewCount:count,buyerReviewRatingSum:sum,buyerAverageRating:count?sum/count:0,updatedAt:FieldValue.serverTimestamp()},{merge:true});return {count,sum};}

export async function GET(req:NextRequest){
  try{
    await requireAdmin(req);
    const [sellerSnap,buyerSnap]=await Promise.all([db.collection("reviews").get(),db.collection("buyerReviews").get()]);
    const reviews=[
      ...sellerSnap.docs.map(d=>({id:d.id,reviewType:"seller" as const,...d.data()})),
      ...buyerSnap.docs.map(d=>({id:d.id,reviewType:"buyer" as const,...d.data()}))
    ];
    return NextResponse.json({reviews});
  }catch{return NextResponse.json({error:"Only the SaharaSnow administrator can access review moderation."},{status:403});}
}

export async function PATCH(req:NextRequest){
  try{
    const admin=await requireAdmin(req);
    const body=schema.parse(await req.json());
    const collectionName=body.reviewType==="seller"?"reviews":"buyerReviews";
    const ref=db.collection(collectionName).doc(body.reviewId);
    const snap=await ref.get();
    if(!snap.exists)return NextResponse.json({error:"Review not found"},{status:404});
    const review=snap.data()||{};
    const sellerId=String(review.sellerId||"");
    const buyerId=String(review.buyerId||"");
    const orderId=String(review.orderId||body.reviewId);
    const targetId=body.reviewType==="seller"?sellerId:buyerId;
    const recalc=body.reviewType==="seller"?recalculateSeller:recalculateBuyer;

    if(body.action==="edit"){
      if(!body.rating&&!body.text)return NextResponse.json({error:"Enter a new rating or review text to update."},{status:400});
      const updates:Record<string,unknown>={editedBy:admin.email,editedAt:FieldValue.serverTimestamp()};
      if(body.rating)updates.rating=body.rating;
      if(body.text)updates.text=body.text;
      await ref.set(updates,{merge:true});
      const totals=targetId?await recalc(targetId):{count:0,sum:0};
      await db.collection("auditLogs").add({adminUid:admin.uid,adminEmail:admin.email||ADMIN_EMAIL,resource:"review",resourceId:body.reviewId,action:"edit",note:body.note||"",sellerId,buyerId,orderId,createdAt:FieldValue.serverTimestamp()});
      return NextResponse.json({ok:true,edited:true,rating:totals});
    }

    if(body.action==="reset"&&!body.note?.trim())return NextResponse.json({error:"Enter a reason when requesting a review change."},{status:400});
    await ref.delete();
    const totals=targetId?await recalc(targetId):{count:0,sum:0};
    if(body.action==="reset"){
      const notifyTargetUserId=body.reviewType==="seller"?buyerId:sellerId;
      if(notifyTargetUserId)await notifyUser({userId:notifyTargetUserId,type:"review_change_requested",eventId:orderId,title:"Review change requested",message:`The SaharaSnow administrator requested that you submit your review again${body.note?`: ${body.note}`:"."}`,link:`/review/${orderId}`,email:true});
    }
    await db.collection("auditLogs").add({adminUid:admin.uid,adminEmail:admin.email||ADMIN_EMAIL,resource:"review",resourceId:body.reviewId,action:body.action,note:body.note||"",sellerId,orderId,buyerId,createdAt:FieldValue.serverTimestamp()});
    return NextResponse.json({ok:true,deleted:true,reviewReset:body.action==="reset",rating:totals});
  }catch(e){
    const message=e instanceof Error?e.message:"Unable to moderate review";
    return NextResponse.json({error:message==="ADMIN_FORBIDDEN"?"Only the SaharaSnow administrator can moderate reviews.":message==="Review not found"?message:"Unable to moderate review."},{status:message==="ADMIN_FORBIDDEN"?403:400});
  }
}
