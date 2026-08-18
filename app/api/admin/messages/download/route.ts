import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { userFromRequest } from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ADMIN_EMAIL=(process.env.SUPER_ADMIN_EMAIL||"yiorgosantoni@gmail.com").toLowerCase();

async function admin(req:NextRequest){
  const user=await userFromRequest(req);
  if((user.email||"").toLowerCase()!==ADMIN_EMAIL)throw new Error("ADMIN_FORBIDDEN");
  return user;
}

export async function GET(req:NextRequest){
  try{
    await admin(req);
    const conversationId=req.nextUrl.searchParams.get("conversationId")||"";
    const messageId=req.nextUrl.searchParams.get("messageId")||"";
    const index=Number(req.nextUrl.searchParams.get("index"));
    if(!conversationId||!messageId||!Number.isInteger(index)||index<0||index>4)
      return NextResponse.json({error:"Invalid attachment request."},{status:400});

    const conversationSnap=await db.collection("conversations").doc(conversationId).get();
    if(!conversationSnap.exists)return NextResponse.json({error:"Conversation not found."},{status:404});
    const conversation=conversationSnap.data()||{};
    if(!Array.isArray(conversation.participants)||conversation.participants.length<2)
      return NextResponse.json({error:"Invalid conversation."},{status:400});

    const messageSnap=await conversationSnap.ref.collection("messages").doc(messageId).get();
    if(!messageSnap.exists)return NextResponse.json({error:"Message not found."},{status:404});
    const message=messageSnap.data()||{};
    const attachments=Array.isArray(message.attachments)?message.attachments:[];
    const attachment=attachments[index];
    if(!attachment||typeof attachment.url!=="string")
      return NextResponse.json({error:"Attachment not found."},{status:404});

    const upstream=await fetch(attachment.url,{cache:"no-store"});
    if(!upstream.ok)return NextResponse.json({error:"The uploaded file is no longer available."},{status:502});

    const body=await upstream.arrayBuffer();
    const filename=String(attachment.name||`attachment-${index+1}`).replace(/[\r\n\\/]+/g,"_").slice(0,180)||`attachment-${index+1}`;
    const type=String(attachment.type||upstream.headers.get("content-type")||"application/octet-stream");
    return new NextResponse(body,{status:200,headers:{"Content-Type":type,"Content-Length":String(body.byteLength),"Content-Disposition":`attachment; filename="${filename.replace(/"/g,"'")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,"Cache-Control":"private, no-store"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to download attachment.";
    const forbidden=message==="ADMIN_FORBIDDEN"||message==="UNAUTHENTICATED";
    return NextResponse.json({error:forbidden?"Only the SaharaSnow administrator can download message attachments.":message},{status:forbidden?403:500});
  }
}
