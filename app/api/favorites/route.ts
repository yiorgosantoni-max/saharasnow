import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";
import {publicError,userFromRequest} from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function jsonDate(value:unknown){return value&&typeof value==="object"&&"toDate" in value&&typeof (value as {toDate?:unknown}).toDate==="function"?(value as {toDate:()=>Date}).toDate().toISOString():value;}

export async function GET(req:NextRequest){try{const user=await userFromRequest(req);const snap=await db.collection("users").doc(user.uid).collection("favorites").orderBy("createdAt","desc").limit(100).get();const ids=snap.docs.map(d=>d.id);const listings=await Promise.all(ids.map(async id=>{const doc=await db.collection("listings").doc(id).get();if(!doc.exists||doc.data()?.status!=="active")return null;const data=doc.data()||{};return {id:doc.id,title:String(data.title||""),category:String(data.category||""),subcategory:String(data.subcategory||""),description:String(data.description||""),sellerId:String(data.sellerId||""),sellerName:String(data.sellerName||""),photoUrls:Array.isArray(data.photoUrls)?data.photoUrls.slice(0,2):[],priceCents:Number(data.priceCents||0),createdAt:jsonDate(snap.docs.find(d=>d.id===id)?.data()?.createdAt)};}));return NextResponse.json({favorites:listings.filter(Boolean)});}catch(error){const result=publicError(error);return NextResponse.json({error:result.message},{status:result.status});}}

export async function POST(req:NextRequest){try{const user=await userFromRequest(req);const body=await req.json();const listingId=String(body?.listingId||"").trim();if(!listingId||listingId.length>160)return NextResponse.json({error:"Invalid service."},{status:400});const listing=await db.collection("listings").doc(listingId).get();if(!listing.exists||listing.data()?.status!=="active")return NextResponse.json({error:"Service is no longer available."},{status:404});await db.collection("users").doc(user.uid).collection("favorites").doc(listingId).set({listingId,createdAt:FieldValue.serverTimestamp()},{merge:true});return NextResponse.json({ok:true,saved:true});}catch(error){const result=publicError(error);return NextResponse.json({error:result.message},{status:result.status});}}

export async function DELETE(req:NextRequest){try{const user=await userFromRequest(req);const body=await req.json();const listingId=String(body?.listingId||"").trim();if(!listingId)return NextResponse.json({error:"Invalid service."},{status:400});await db.collection("users").doc(user.uid).collection("favorites").doc(listingId).delete();return NextResponse.json({ok:true,saved:false});}catch(error){const result=publicError(error);return NextResponse.json({error:result.message},{status:result.status});}}
