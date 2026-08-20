import {NextRequest,NextResponse}from"next/server";
import {db}from"@/lib/firebase-admin";
import {publicError,userFromRequest}from"@/lib/server";
export async function GET(req:NextRequest){try{const user=await userFromRequest(req);const snap=await db.collection("orders").where("sellerId","==",user.uid).limit(500).get();const inactive=new Set(["cancelled","canceled","deleted","refunded","payment-failed","awaiting-crypto-payment"]);const orders=snap.docs.filter(d=>{const o=d.data()||{};return !inactive.has(String(o.status||"").toLowerCase());});return NextResponse.json({count:orders.length,orders:orders.map(d=>({id:d.id,status:d.data().status||""}))});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
