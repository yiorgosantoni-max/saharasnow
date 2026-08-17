import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){try{const user=await userFromRequest(req);const listings=await db.collection("listings").where("status","==","active").limit(200).get();const own=await db.collection("orders").where("buyerId","==",user.uid).limit(100).get();const seen=new Set(own.docs.map(d=>String(d.data()?.listingId||"")));const rows=listings.docs.map(d=>({id:d.id,...d.data()})).filter((x:any)=>x.sellerId!==user.uid);rows.sort((a:any,b:any)=>Number(seen.has(b.id))-Number(seen.has(a.id))||Number(b.rating||0)-Number(a.rating||0)||Number(b.completedOrders||0)-Number(a.completedOrders||0));return NextResponse.json({recommendations:rows.slice(0,20)});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
