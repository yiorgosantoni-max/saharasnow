import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { publicError,required,userFromRequest } from "@/lib/server";
import { notifyUser } from "@/lib/notifications";

const attachmentSchema=z.object({
  name:z.string().min(1).max(255),
  url:z.string().url().max(2000),
  size:z.number().int().positive().max(100*1024*1024),
  type:z.string().max(255).optional().default("application/octet-stream"),
  path:z.string().max(500).optional()
});
const schema=z.object({recipientId:z.string().min(1),text:z.string().max(4000).default(""),orderId:z.string().optional(),attachments:z.array(attachmentSchema).max(5).default([])}).refine(body=>body.text.trim().length>0||body.attachments.length>0,{message:"Add a message or attach at least one file."});
const dateValue=(value:unknown)=>value&&typeof value==="object"&&"toDate" in value&&typeof (value as {toDate?:unknown}).toDate==="function"?(value as {toDate:()=>Date}).toDate().toISOString():null;
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]||character));

export async function GET(req:NextRequest){try{const user=await userFromRequest(req);const conversations=await db.collection("conversations").where("participants","array-contains",user.uid).limit(100).get();const items=await Promise.all(conversations.docs.map(async conversation=>{const data=conversation.data(),otherId=(Array.isArray(data.participants)?data.participants:[]).find((id:string)=>id!==user.uid)||"",[profileSnap,messagesSnap]=await Promise.all([db.collection("users").doc(String(otherId)).get(),conversation.ref.collection("messages").limit(200).get()]),profile=profileSnap.data()||{},messages=messagesSnap.docs.map(message=>({id:message.id,...message.data(),createdAt:dateValue(message.data().createdAt)})).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));return {id:conversation.id,otherUser:{id:String(otherId),name:[profile.firstName,profile.lastName].filter(Boolean).join(" ")||"SaharaSnow user",image:String(profile.profileImageUrl||"")},updatedAt:dateValue(data.updatedAt),messages};}));items.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));return NextResponse.json({conversations:items});}catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}}

export async function POST(req:NextRequest){
 try{
  const user=await userFromRequest(req),body=schema.parse(await req.json());
  if(user.uid===body.recipientId)return NextResponse.json({error:"You cannot message your own account"},{status:400});
  const [senderSnap,recipientSnap]=await Promise.all([db.collection("users").doc(user.uid).get(),db.collection("users").doc(body.recipientId).get()]);
  const senderProfile=senderSnap.data()||{},recipientProfile=recipientSnap.data()||{};

  // KYC approval is stored on the user profile by the admin API, but older/partially
  // migrated accounts may only have the approval on the dedicated `kyc` record.
  // Treat either source as authoritative so approved users are not incorrectly
  // blocked when they send a normal message or an attachment.
  const senderKycSnap=await db.collection("kyc").doc(user.uid).get();
  const senderKycRecord=senderKycSnap.data()||{};
  const senderKycApproved=senderProfile.kycStatus==="approved"||senderKycRecord.status==="approved";

  let allowed=senderKycApproved;
  if(!allowed){const [asBuyer,recipientAsBuyer]=await Promise.all([db.collection("orders").where("buyerId","==",user.uid).limit(500).get(),db.collection("orders").where("buyerId","==",body.recipientId).limit(500).get()]);allowed=asBuyer.docs.some(order=>order.data().sellerId===body.recipientId&&["completed","completed-released"].includes(String(order.data().status)))||recipientAsBuyer.docs.some(order=>order.data().sellerId===user.uid&&["completed","completed-released"].includes(String(order.data().status)));}
  if(!allowed)return NextResponse.json({error:"Messaging is available after your KYC is approved or after you complete an order with this seller."},{status:403});
  const conversationId=[user.uid,body.recipientId].sort().join("_"),conversationRef=db.collection("conversations").doc(conversationId);
  const attachmentLabel=body.attachments.length===1?`📎 ${body.attachments[0].name}`:`📎 ${body.attachments.length} attachments`;
  const messageText=body.text.trim()||attachmentLabel;
  await conversationRef.set({participants:[user.uid,body.recipientId],updatedAt:FieldValue.serverTimestamp(),lastMessage:messageText.slice(0,160),lastSenderId:user.uid},{merge:true});
  const message=await conversationRef.collection("messages").add({senderId:user.uid,text:messageText,orderId:body.orderId??null,attachments:body.attachments,createdAt:FieldValue.serverTimestamp(),emailNotificationStatus:"pending"});
  await notifyUser({userId:body.recipientId,type:"new_message",eventId:message.id,title:"New message",message:`${[senderProfile.firstName,senderProfile.lastName].filter(Boolean).join(" ")||"A SaharaSnow user"} sent you a new message${body.attachments.length ? ` with ${body.attachments.length} upload${body.attachments.length===1?"":"s"}` : ""}.`,link:"/?inbox=1"});
  if(recipientProfile.email){
   const senderName=[senderProfile.firstName,senderProfile.lastName].filter(Boolean).join(" ")||"A SaharaSnow user",recipientName=[recipientProfile.firstName,recipientProfile.lastName].filter(Boolean).join(" ")||"there",appUrl=required("APP_URL"),preview=messageText.length>280?`${messageText.slice(0,280)}…`:messageText;
   try{const result=await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(recipientProfile.email),subject:`New SaharaSnow message from ${senderName}`,html:`<div style="font-family:Arial,sans-serif;color:#17154a;max-width:620px;margin:auto;padding:24px"><img src="${appUrl}/logo.png" alt="SaharaSnow" width="72" height="72" style="object-fit:contain"><h1>You have a new message</h1><p>Hello ${escapeHtml(recipientName)},</p><p><b>${escapeHtml(senderName)}</b> sent you a new SaharaSnow inbox message:</p><div style="background:#f5f3f8;border-left:4px solid #ff6f61;border-radius:8px;padding:16px;white-space:pre-wrap">${escapeHtml(preview)}</div><p><a href="${appUrl}/?inbox=1" style="display:inline-block;background:#17154a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:bold">Open your SaharaSnow inbox</a></p><p style="font-size:12px;color:#716f82">Reply through SaharaSnow to keep your conversation protected.</p></div>`});if(result.error)throw new Error(result.error.message);await message.set({emailNotificationStatus:"sent",emailNotificationSentAt:FieldValue.serverTimestamp()},{merge:true});}
   catch(error){await message.set({emailNotificationStatus:"failed",emailNotificationError:error instanceof Error?error.message:"Email delivery failed"},{merge:true});}
  }
  return NextResponse.json({id:message.id});
 }catch(e){const x=publicError(e);return NextResponse.json({error:x.message},{status:x.status});}
}
