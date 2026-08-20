import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { notifyAdminInApp } from "@/lib/notifications";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
  attachmentIndex: z.number().int().min(0).optional(),
  reason: z.string().trim().min(3).max(500),
}).refine(v => Boolean(v.messageId || v.attachmentIndex !== undefined), {message:"A message or upload must be selected."});

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = schema.parse(await req.json());
    let messageData: Record<string,unknown> = {};
    let conversationId = body.conversationId || "";
    if (conversationId && body.messageId) {
      const conversation = await db.collection("conversations").doc(conversationId).get();
      if (!conversation.exists || !(Array.isArray(conversation.data()?.participants) && conversation.data()?.participants.includes(user.uid))) return NextResponse.json({error:"Conversation not found."},{status:404});
      const message = await conversation.ref.collection("messages").doc(body.messageId).get();
      if (!message.exists) return NextResponse.json({error:"Message not found."},{status:404});
      messageData = message.data() || {};
    } else if (body.messageId) {
      const conversations = await db.collection("conversations").where("participants","array-contains",user.uid).limit(100).get();
      for (const conversation of conversations.docs) {
        const message = await conversation.ref.collection("messages").doc(body.messageId).get();
        if (message.exists) { conversationId = conversation.id; messageData = message.data() || {}; break; }
      }
    }
    if (!conversationId || !messageData || Object.keys(messageData).length === 0) return NextResponse.json({error:"Report target not found."},{status:404});
    const participants = (await db.collection("conversations").doc(conversationId).get()).data()?.participants;
    if (!Array.isArray(participants) || !participants.includes(user.uid)) return NextResponse.json({error:"You cannot report this content."},{status:403});
    const report = db.collection("contentReports").doc();
    const attachments = Array.isArray(messageData.attachments) ? messageData.attachments : [];
    await report.set({
      reporterId:user.uid,
      conversationId,
      messageId:body.messageId || null,
      attachmentIndex:body.attachmentIndex ?? null,
      reason:body.reason,
      messageText:String(messageData.text || "").slice(0,4000),
      attachment:body.attachmentIndex !== undefined ? attachments[body.attachmentIndex] || null : null,
      senderId:String(messageData.senderId || ""),
      status:"open",
      createdAt:FieldValue.serverTimestamp(),
    });
    await notifyAdminInApp({type:"content_report",eventId:report.id,title:"New content report",message:`A buyer or seller reported a message or upload. Reason: ${body.reason}`,link:"/admin"});
    return NextResponse.json({ok:true,id:report.id});
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({error:result.message},{status:result.status});
  }
}
