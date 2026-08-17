import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { publicError, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as {toDate?:unknown}).toDate === "function") return (value as {toDate:()=>Date}).toDate().toISOString();
  return value;
};

export async function GET(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const snap = await db.collection("notifications").where("userId", "==", user.uid).limit(200).get();
    const notifications = snap.docs.map(doc => ({id: doc.id, ...doc.data(), createdAt: jsonValue(doc.data().createdAt)})).sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return NextResponse.json({notifications});
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({error:result.message},{status:result.status});
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await userFromRequest(req);
    const body = await req.json();
    if (body.all === true) {
      const snap = await db.collection("notifications").where("userId", "==", user.uid).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.update(doc.ref, {read:true, readAt:FieldValue.serverTimestamp()}));
      await batch.commit();
      return NextResponse.json({ok:true});
    }
    const id = String(body.id || "");
    if (!id) return NextResponse.json({error:"Notification ID is required."},{status:400});
    const ref = db.collection("notifications").doc(id), snap = await ref.get();
    if (!snap.exists || String(snap.data()?.userId) !== user.uid) return NextResponse.json({error:"Notification not found."},{status:404});
    await ref.set({read:true,readAt:FieldValue.serverTimestamp()},{merge:true});
    return NextResponse.json({ok:true});
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({error:result.message},{status:result.status});
  }
}
