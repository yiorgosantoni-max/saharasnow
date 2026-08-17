import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest){try{const user=await userFromRequest(req);const orderId=String(new URL(req.url).searchParams.get("orderId")||"");if(!orderId) return NextResponse.json({error:"orderId is required"},{status:400});const order=await db.collection("orders").doc(orderId).get();if(!order.exists)return NextResponse.json({error:"Order not found"},{status:404});const o=order.data()||{};if(String(o.buyerId)!==user.uid&&String(o.sellerId)!==user.uid)return NextResponse.json({error:"Forbidden"},{status:403});const events=await db.collection("orders").doc(orderId).collection("events").orderBy("createdAt","asc").limit(200).get();return NextResponse.json({events:events.docs.map(d=>({id:d.id,...d.data()}))});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function POST(req:NextRequest){try{const user=await userFromRequest(req);const body=await req.json();const orderId=String(body.orderId||"");const type=String(body.type||"").trim();const message=String(body.message||"").trim();if(!orderId||!type||!message)return NextResponse.json({error:"orderId, type and message are required"},{status:400});const ref=db.collection("orders").doc(orderId);const snap=await ref.get();if(!snap.exists)return NextResponse.json({error:"Order not found"},{status:404});const o=snap.data()||{};if(String(o.buyerId)!==user.uid&&String(o.sellerId)!==user.uid)return NextResponse.json({error:"Forbidden"},{status:403});const event=ref.collection("events").doc();await event.set({type,message,actorId:user.uid,createdAt:FieldValue.serverTimestamp()});return NextResponse.json({ok:true,id:event.id});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
