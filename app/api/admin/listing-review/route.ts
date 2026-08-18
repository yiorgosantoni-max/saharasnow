import {FieldValue} from "firebase-admin/firestore";
import {NextRequest,NextResponse} from "next/server";
import {Resend} from "resend";
import {z} from "zod";
import {db} from "@/lib/firebase-admin";
import {notifyUser} from "@/lib/notifications";
import {required,userFromRequest} from "@/lib/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ADMIN_EMAIL=(process.env.SUPER_ADMIN_EMAIL||"yiorgosantoni@gmail.com").toLowerCase();
const schema=z.object({id:z.string().min(1).max(200),action:z.enum(["approve","reject"]),note:z.string().trim().max(500).optional()});

async function admin(req:NextRequest){const user=await userFromRequest(req);if((user.email||"").toLowerCase()!==ADMIN_EMAIL)throw new Error("ADMIN_FORBIDDEN");return user;}
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

async function publicationEmail(sellerId:string,title:string,category:string,subcategory:string,id:string,edited:boolean){const seller=(await db.collection("users").doc(sellerId).get()).data()||{};if(!seller.email)return;const sellerName=[seller.firstName,seller.lastName].filter(Boolean).join(" ")||"seller";const serviceUrl=`${required("APP_URL")}/service/${slugify(subcategory||category||"service")}/${id}`;const result=await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(seller.email),subject:`Your SaharaSnow ${edited?"listing changes are live":"service is now published"}: ${title}`,html:`<div style="font-family:Arial,sans-serif;color:#17154a;max-width:620px;margin:auto;padding:24px"><img src="${required("APP_URL")}/logo.png" alt="SaharaSnow" width="74" height="74" style="object-fit:contain"><h1>${edited?"Your listing changes are live":"Your service is live"}</h1><p>Hello ${sellerName},</p><p>${edited?`Your edited service <b>${title}</b> has been approved. All submitted details, both service images and the video/YouTube link are now live.`:`Your service <b>${title}</b> has been approved and published on SaharaSnow.`}</p><p><a href="${serviceUrl}" style="display:inline-block;background:#ff6f61;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:bold">View your live service</a></p></div>`});if(result.error)console.error("Listing publication email failed",result.error.message);await db.collection("listings").doc(id).set({publicationEmailSentAt:FieldValue.serverTimestamp(),serviceUrl},{merge:true});}

export async function PATCH(req:NextRequest){try{const acting=await admin(req),body=schema.parse(await req.json()),ref=db.collection("listings").doc(body.id),snap=await ref.get();if(!snap.exists)return NextResponse.json({error:"Listing not found."},{status:404});const current=snap.data()||{};if(current.status==="awaiting-listing-fee")return NextResponse.json({error:"The seller must complete the listing-credit payment before this listing can be published."},{status:400});
 const pending=current.pendingEdit&&typeof current.pendingEdit==="object"?current.pendingEdit as Record<string,unknown>:null;const hasPending=current.pendingEditStatus==="pending-approval"&&!!pending;
 if(body.action==="approve"&&hasPending){
  const approvedEdit={...pending!};delete approvedEdit.submittedAt;delete approvedEdit.submittedBy;
  const published={...approvedEdit,status:"active",pendingEdit:FieldValue.delete(),pendingEditStatus:FieldValue.delete(),pendingEditSubmittedAt:FieldValue.delete(),pendingEditRejectedAt:FieldValue.delete(),editApprovedAt:FieldValue.serverTimestamp(),moderationNote:body.note||"",moderatedBy:acting.email,updatedAt:FieldValue.serverTimestamp()};
  await ref.set(published,{merge:true});
  const sellerId=String(current.sellerId||""),serviceTitle=String(approvedEdit.title||current.title||"Service"),category=String(approvedEdit.category||current.category||""),subcategory=String(approvedEdit.subcategory||current.subcategory||"");
  if(sellerId)await notifyUser({userId:sellerId,type:"listing_edit_approved",eventId:`${body.id}_edit_approved`,title:"Listing changes approved",message:`Your changes to “${serviceTitle}” were approved and are now live.`,link:`/service/${slugify(subcategory||category||"service")}/${body.id}`,email:true});
  if(sellerId)await publicationEmail(sellerId,serviceTitle,category,subcategory,body.id,true);
  await db.collection("auditLogs").add({adminUid:acting.uid,adminEmail:acting.email||ADMIN_EMAIL,resource:"listing",resourceId:body.id,action:"approve-seller-edit",note:body.note||"Approved seller edits and published all pending listing media/settings.",createdAt:FieldValue.serverTimestamp()});
  return NextResponse.json({ok:true,status:"active",publishedEdit:true});
 }
 if(body.action==="reject"&&hasPending){
  await ref.set({pendingEdit:FieldValue.delete(),pendingEditStatus:FieldValue.delete(),pendingEditSubmittedAt:FieldValue.delete(),pendingEditRejectedAt:FieldValue.serverTimestamp(),editRejectedBy:acting.email,moderationNote:body.note||"",updatedAt:FieldValue.serverTimestamp()},{merge:true});
  if(current.sellerId)await notifyUser({userId:String(current.sellerId),type:"listing_edit_rejected",eventId:`${body.id}_edit_rejected`,title:"Listing changes rejected",message:`Your submitted changes to “${String(current.title||"Service") }” were not approved${body.note?`: ${body.note}`:"."} Your previous approved version remains live.`,link:"/?services=1",email:true});
  await db.collection("auditLogs").add({adminUid:acting.uid,adminEmail:acting.email||ADMIN_EMAIL,resource:"listing",resourceId:body.id,action:"reject-seller-edit",note:body.note||"Rejected seller edits; previous approved listing remains live.",createdAt:FieldValue.serverTimestamp()});
  return NextResponse.json({ok:true,status:String(current.status||"active"),rejectedEdit:true});
 }
 const status=body.action==="approve"?"active":"rejected";
 await ref.set({status,moderationNote:body.note||"",moderatedBy:acting.email,updatedAt:FieldValue.serverTimestamp()},{merge:true});
 if(current.sellerId)await notifyUser({userId:String(current.sellerId),type:`listing_${status}`,eventId:body.id,title:status==="active"?"Listing approved":"Listing rejected",message:status==="active"?`Your listing “${String(current.title||"Service") }” is now published.`:`Your listing “${String(current.title||"Service") }” was rejected${body.note?`: ${body.note}`:"."}`,link:status==="active"?`/service/${slugify(String(current.subcategory||current.category||"service"))}/${body.id}`:"/?services=1",email:true});
 if(status==="active"&&current.sellerId)await publicationEmail(String(current.sellerId),String(current.title||"Service"),String(current.category||""),String(current.subcategory||""),body.id,false);
 await db.collection("auditLogs").add({adminUid:acting.uid,adminEmail:acting.email||ADMIN_EMAIL,resource:"listing",resourceId:body.id,action:body.action==="approve"?"approve-listing":"reject-listing",note:body.note||"",createdAt:FieldValue.serverTimestamp()});
 return NextResponse.json({ok:true,status});
 }catch(error){const message=error instanceof Error?error.message:"Unable to review listing.";const status=message==="ADMIN_FORBIDDEN"||message==="UNAUTHENTICATED"?403:400;return NextResponse.json({error:status===403?"Only the SaharaSnow administrator can review listings.":message},{status});}}
