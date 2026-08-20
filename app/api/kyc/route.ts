import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";
import { notifyAdmin } from "@/lib/admin-notifications";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  documentType: z.enum(["ID","PASSPORT"]),
  idDocumentUrl: z.string().url(),
  selfieDocumentUrl: z.string().url()
});

export async function POST(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = schema.parse(await req.json());
    const profile=(await db.collection("users").doc(user.uid).get()).data()||{};
    if(!String(profile.firstName||"").trim()||!String(profile.lastName||"").trim()||!String(profile.country||"").trim())return NextResponse.json({error:"Complete and save your first name, surname and country before submitting KYC."},{status:400});
    const submission = {userId:user.uid,email:user.email,...body,status:"pending",submittedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
    await db.runTransaction(async tx=>{
      tx.set(db.collection("kyc").doc(user.uid),submission,{merge:true});
      tx.set(db.collection("users").doc(user.uid),{kycStatus:"pending",kycReviewNote:"",updatedAt:FieldValue.serverTimestamp()},{merge:true});
    });
    await notifyAdmin({subject:`KYC review required: ${user.email||user.uid}`,heading:"New KYC application",message:"A user submitted identity documents and is waiting for administrator review.",details:{Email:user.email||"Not available","User ID":user.uid,"Document type":body.documentType,Status:"Pending review"},actionLabel:"Review KYC application",actionPath:"/admin"});
    await notifyUser({userId:user.uid,type:"kyc_submitted",eventId:`${user.uid}_submitted`,title:"KYC submitted",message:"Your KYC documents were submitted successfully and are waiting for administrator review.",link:"/?kyc=1"});
    return NextResponse.json({ok:true,status:"pending"});
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({error:result.message},{status:result.status});
  }
}
