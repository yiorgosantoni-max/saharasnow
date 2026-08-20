import { createHash } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { required } from "@/lib/server";
import { notifyAdminInApp } from "@/lib/notifications";

const schema=z.object({name:z.string().trim().min(2).max(80),email:z.string().trim().email().max(254),subject:z.string().trim().min(3).max(120),message:z.string().trim().min(20).max(5000),website:z.string().max(0).optional()});
const clean=(value:string)=>value.replace(/[<>&"']/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&#39;"}[char]!));

export async function POST(req:NextRequest){
  try{
    const body=schema.parse(await req.json());
    const ip=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
    const bucket=Math.floor(Date.now()/3_600_000);
    const rateId=createHash("sha256").update(`${ip}:${bucket}`).digest("hex");
    const rateRef=db.collection("contactRateLimits").doc(rateId);
    await db.runTransaction(async tx=>{const snap=await tx.get(rateRef);const count=Number(snap.data()?.count||0);if(count>=5)throw new Error("Too many messages. Please try again in one hour.");tx.set(rateRef,{count:count+1,expiresAt:new Date((bucket+2)*3_600_000)},{merge:true});});
    const ticket=db.collection("supportTickets").doc();
    await ticket.set({reference:`SUP-${ticket.id.slice(0,8).toUpperCase()}`,name:body.name,email:body.email.toLowerCase(),subject:body.subject,message:body.message,status:"open",source:"admin-contact-form",createdAt:FieldValue.serverTimestamp()});
    await notifyAdminInApp({type:"support_ticket",eventId:ticket.id,title:"New support request",message:`${body.subject} — ${body.message.slice(0,180)}`,link:"/admin"});
    const reference=`SUP-${ticket.id.slice(0,8).toUpperCase()}`;const resend=new Resend(required("RESEND_API_KEY"));
    await resend.emails.send({from:required("EMAIL_FROM"),to:required("ADMIN_EMAIL"),replyTo:body.email,subject:`[${reference}] ${body.subject}`,html:`<h1>New SaharaSnow support request</h1><p><b>Reference:</b> ${reference}</p><p><b>From:</b> ${clean(body.name)} (${clean(body.email)})</p><p><b>Subject:</b> ${clean(body.subject)}</p><hr><p style="white-space:pre-wrap">${clean(body.message)}</p>`});
    await resend.emails.send({from:required("EMAIL_FROM"),to:body.email,subject:`We received your SaharaSnow request — ${reference}`,html:`<h1 style="color:#075ee8">saharasnow</h1><p>Hello ${clean(body.name)},</p><p>Your message has been sent to the administrator. Your reference is <b>${reference}</b>.</p><p>Keep this reference if you need to follow up.</p>`});
    return NextResponse.json({ok:true,reference});
  }catch(error){const message=error instanceof Error?error.message:"Unable to send message";return NextResponse.json({error:message},{status:message.startsWith("Too many")?429:400});}
}
