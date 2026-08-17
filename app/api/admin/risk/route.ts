import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

async function admin(req:NextRequest){const u=await userFromRequest(req);const allowed=String(process.env.SUPER_ADMIN_EMAIL||process.env.ADMIN_EMAIL||"").toLowerCase();if(!allowed||String(u.email||"").toLowerCase()!==allowed)throw new Error("FORBIDDEN");return u;}
export async function GET(req:NextRequest){try{await admin(req);const users=await db.collection("users").limit(1000).get();const orders=await db.collection("orders").limit(2000).get();const byUser=new Map<string,any>();for(const d of users.docs)byUser.set(d.id,{id:d.id,email:d.data()?.email||"",flags:[],score:0});for(const d of orders.docs){const o=d.data();for(const uid of [String(o.buyerId||""),String(o.sellerId||"")]){const x=byUser.get(uid);if(!x)continue;if(["disputed","refunded"].includes(String(o.status)))x.score+=15;if(Number(o.chargeback)||o.chargeback===true)x.score+=50;if(Number(o.cancellationCount||0)>2)x.score+=10;}}const rows=[...byUser.values()].map(x=>({...x,score:Math.min(100,x.score),risk:x.score>=50?"high":x.score>=25?"medium":"low"})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);return NextResponse.json({users:rows});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}
