import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const countedStatuses=new Set(["paid","in-progress","delivered","completed-released"]);

export async function GET(req:NextRequest){
 try{
  const listingId=req.nextUrl.searchParams.get("listingId")?.trim();
  if(!listingId)return NextResponse.json({error:"listingId is required"},{status:400});
  const listingSnap=await db.collection("listings").doc(listingId).get();
  if(!listingSnap.exists)return NextResponse.json({error:"Listing not found"},{status:404});
  const sellerId=String(listingSnap.data()?.sellerId||"");
  if(!sellerId)return NextResponse.json({orderCount:0});
  const orders=await db.collection("orders").where("sellerId","==",sellerId).limit(500).get();
  const orderCount=orders.docs.reduce((count,doc)=>count+(countedStatuses.has(String(doc.data()?.status||""))?1:0),0);
  return NextResponse.json({orderCount});
 }catch{return NextResponse.json({orderCount:0});}
}
