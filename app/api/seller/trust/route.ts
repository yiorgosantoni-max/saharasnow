import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const orders = await db.collection("orders").where("sellerId","==",user.uid).limit(500).get();
    const reviews = await db.collection("reviews").where("sellerId","==",user.uid).limit(500).get();
    const rows=orders.docs.map(d=>d.data());
    const completed=rows.filter(o=>String(o.status)==="completed-released").length;
    const cancelled=rows.filter(o=>["cancelled","refunded"].includes(String(o.status))).length;
    const rated=reviews.docs.map(d=>d.data()).filter(r=>Number.isFinite(Number(r.rating)));
    const rating=rated.length?rated.reduce((n,r)=>n+Number(r.rating),0)/rated.length:0;
    const onTime=rows.filter(o=>o.deliveredAt && o.dueAt && new Date(String(o.deliveredAt)).getTime()<=new Date(String(o.dueAt)).getTime()).length;
    const delivered=rows.filter(o=>o.deliveredAt).length;
    const responseTimes=rows.map(o=>Number(o.firstResponseMinutes)).filter(n=>Number.isFinite(n)&&n>=0);
    const responseRate=rows.length?rows.filter(o=>o.firstResponseAt||o.respondedAt).length/rows.length:0;
    const avgResponseMinutes=responseTimes.length?responseTimes.reduce((a,b)=>a+b,0)/responseTimes.length:null;
    const onTimeRate=delivered?onTime/delivered:0;
    const cancellationRate=rows.length?cancelled/rows.length:0;
    const trust=Math.max(0,Math.min(100,Math.round(rating/5*35+onTimeRate*25+responseRate*20+(1-cancellationRate)*20)));
    return NextResponse.json({trustScore:trust,rating:Math.round(rating*100)/100,reviewCount:rated.length,completedOrders:completed,onTimeRate,cancellationRate,responseRate,avgResponseMinutes});
  } catch(error){const x=publicError(error);return NextResponse.json({error:x.message},{status:x.status});}
}
