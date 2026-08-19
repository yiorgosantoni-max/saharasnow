import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
 try{
  const listingId=req.nextUrl.searchParams.get("listingId")?.trim();
  if(!listingId)return NextResponse.json({error:"listingId is required"},{status:400});
  const listingSnap=await db.collection("listings").doc(listingId).get();
  if(!listingSnap.exists)return NextResponse.json({error:"Listing not found"},{status:404});
  const sellerId=String(listingSnap.data()?.sellerId||"");
  if(!sellerId)return NextResponse.json({sellerId:"",orderCount:0});
  const orders=await db.collection("orders").where("sellerId","==",sellerId).where("status","==","completed-released").limit(500).get();
  return NextResponse.json({sellerId,orderCount:orders.size});
 }catch{return NextResponse.json({sellerId:"",orderCount:0});}
}
