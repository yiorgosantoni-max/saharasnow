import {NextRequest,NextResponse} from "next/server";
import {FieldValue} from "firebase-admin/firestore";
import {db} from "@/lib/firebase-admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function listingIdFrom(req:NextRequest){return String(req.nextUrl.searchParams.get("listingId")||"").trim();}
function valid(id:string){return Boolean(id)&&id.length<=160;}

export async function GET(req:NextRequest){
 try{
  const listingId=listingIdFrom(req);
  if(!valid(listingId))return NextResponse.json({error:"Invalid service."},{status:400});
  const doc=await db.collection("listings").doc(listingId).get();
  if(!doc.exists||doc.data()?.status!=="active")return NextResponse.json({error:"Service not found."},{status:404});
  const data=doc.data()||{};
  let favoriteCount=Math.max(0,Number(data.favoriteCount||0));
  // Prefer the stored counter, but repair old listings that predate the counter when possible.
  try{const aggregate=await db.collectionGroup("favorites").where("listingId","==",listingId).count().get();favoriteCount=Number(aggregate.data().count||0);}catch{}
  return NextResponse.json({listingId,shareCount:Math.max(0,Number(data.shareCount||0)),favoriteCount});
 }catch{return NextResponse.json({error:"Unable to load engagement."},{status:500});}
}

export async function POST(req:NextRequest){
 try{
  const body=await req.json();
  const listingId=String(body?.listingId||"").trim();
  if(!valid(listingId))return NextResponse.json({error:"Invalid service."},{status:400});
  const ref=db.collection("listings").doc(listingId);
  const listing=await ref.get();
  if(!listing.exists||listing.data()?.status!=="active")return NextResponse.json({error:"Service not found."},{status:404});
  await ref.set({shareCount:FieldValue.increment(1),lastSharedAt:FieldValue.serverTimestamp()},{merge:true});
  const updated=await ref.get();
  return NextResponse.json({ok:true,shareCount:Math.max(0,Number(updated.data()?.shareCount||0))});
 }catch{return NextResponse.json({error:"Unable to record share."},{status:500});}
}
