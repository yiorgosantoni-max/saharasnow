import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { adminAuth, db } from "@/lib/firebase-admin";
import { notifyUser } from "@/lib/notifications";
import { postSystemMessage } from "@/lib/messaging";
import { required, userFromRequest } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "yiorgosantoni@gmail.com").toLowerCase();
const actionSchema = z.object({
  resource: z.enum(["kyc", "listing", "withdrawal", "order", "ticket", "user", "users", "report", "auditLogs"]),
  id: z.string().min(1).max(200),
  action: z.enum(["approve", "reject", "reupload", "delete", "paid", "release", "refund", "resolve", "close", "suspend", "restore", "clearAll", "deleteSelected", "forceLogoutAll", "deleteSelectedOrders", "deleteSelectedListings", "resetPhone", "restoreKyc"]),
  ids: z.array(z.string().min(1).max(200)).max(200).optional(),
  note: z.string().trim().max(500).optional(),
  sellerAmount: z.number().min(0).max(1000000).optional(),
  buyerAmount: z.number().min(0).max(1000000).optional()
});

async function admin(req: NextRequest) {
  const user = await userFromRequest(req);
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) throw new Error("ADMIN_FORBIDDEN");
  return user;
}

function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as {toDate?:unknown}).toDate === "function") return (value as {toDate:()=>Date}).toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,jsonValue(v)]));
  return value;
}

type RecentItem = Record<string, unknown> & { id: string };

async function recent(collection: string, limit = 100): Promise<RecentItem[]> {
  const snap = await db.collection(collection).limit(limit).get();
  return snap.docs.map(doc => jsonValue({id: doc.id, ...doc.data()}) as RecentItem);
}

const NETWORK_LABEL: Record<string,string> = { USDT: "Tron (TRC20)", USDC: "BNB Smart Chain (BEP20)" };

async function withSellerProfiles(withdrawals: RecentItem[]): Promise<RecentItem[]> {
  const sellerIds = [...new Set(withdrawals.map(w => String(w.sellerId || "")).filter(Boolean))];
  const sellerSnaps = await Promise.all(sellerIds.map(id => db.collection("users").doc(id).get()));
  const sellers = new Map(sellerSnaps.filter(s => s.exists).map(s => [s.id, (s.data() || {}) as Record<string, unknown>]));
  return withdrawals.map(w => {
    const seller = sellers.get(String(w.sellerId || "")) || {};
    const currency = String(w.currency || "").toUpperCase();
    return {
      ...w,
      sellerFirstName: String(seller.firstName || ""),
      sellerLastName: String(seller.lastName || ""),
      sellerEmail: String(seller.email || ""),
      sellerProfileImageUrl: String(seller.profileImageUrl || ""),
      payoutNetwork: String(w.payoutNetwork || NETWORK_LABEL[currency] || ""),
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    await admin(req);
    const [kyc, listings, rawWithdrawals, orders, tickets, users, auditLogs, reports] = await Promise.all([
      recent("kyc"), recent("listings"), recent("withdrawals"),
      recent("orders").then((items: RecentItem[]) => items.filter((item: RecentItem) => ["paid","in-progress","delivered","disputed","completed-released","refunded"].includes(String(item.status)))),
      recent("supportTickets"), recent("users", 100), recent("auditLogs", 200), recent("contentReports", 200)
    ]);
    const withdrawals = await withSellerProfiles(rawWithdrawals);
    const earnings = users.map((user: RecentItem) => ({id:user.id,name:user.name,email:user.email,mode:user.mode||user.accountMode||"BUYING",totalEarningsCents:Number(user.totalEarningsCents||0),pendingEarningsCents:Number(user.pendingEarningsCents||0),availableBalanceCents:Number(user.availableBalanceCents||0),withdrawnCents:Number(user.withdrawnCents||0)}));
    return NextResponse.json({adminEmail: ADMIN_EMAIL, kyc, listings, withdrawals, orders, tickets, users, earnings, auditLogs, reports});
  } catch (error) {
    const forbidden = error instanceof Error && (error.message === "ADMIN_FORBIDDEN" || error.message === "UNAUTHENTICATED");
    return NextResponse.json({error: forbidden ? "Only the SaharaSnow administrator can access this dashboard." : "Unable to load the admin dashboard."}, {status: forbidden ? 403 : 500});
  }
}

async function clearCollection(collection: string) {
  while (true) {
    const snap = await db.collection(collection).limit(450).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    if (snap.size < 450) return;
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actingAdmin = await admin(req);
    const body = actionSchema.parse(await req.json());

    if (body.resource === "users" && body.action === "forceLogoutAll") {
      let revoked = 0;
      let nextPageToken: string | undefined;
      do {
        const page = await adminAuth.listUsers(1000, nextPageToken);
        for (const record of page.users) {
          if (record.email?.toLowerCase() === ADMIN_EMAIL) continue;
          await adminAuth.revokeRefreshTokens(record.uid);
          revoked++;
        }
        nextPageToken = page.pageToken;
      } while (nextPageToken);
      await db.collection("auditLogs").add({adminUid:actingAdmin.uid,adminEmail:actingAdmin.email,resource:"users",resourceId:"all",action:"forceLogoutAll",note:"Revoked all buyer/seller Firebase sessions; admin account excluded.",createdAt:FieldValue.serverTimestamp()});
      return NextResponse.json({ok:true,revoked});
    }

    if (body.resource === "order" && body.action === "deleteSelectedOrders") {
      const ids = body.ids || [];
      const batch = db.batch();
      for (const id of ids) batch.delete(db.collection("orders").doc(id));
      await batch.commit();
      await db.collection("auditLogs").add({adminUid:actingAdmin.uid,adminEmail:actingAdmin.email,resource:"order",resourceId:"selected",action:"deleteSelectedOrders",note:`Deleted ${ids.length} selected orders/disputes.`,createdAt:FieldValue.serverTimestamp()});
      return NextResponse.json({ok:true,deleted:ids.length});
    }
    if (body.resource === "listing" && body.action === "deleteSelectedListings") {
      const ids = body.ids || [];
      if (!ids.length) return NextResponse.json({ok:true,deleted:0});
      const batch = db.batch();
      for (const id of ids) batch.delete(db.collection("listings").doc(id));
      await batch.commit();
      await db.collection("auditLogs").add({adminUid:actingAdmin.uid,adminEmail:actingAdmin.email,resource:"listing",resourceId:"selected",action:"deleteSelectedListings",note:`Deleted ${ids.length} selected listings from the marketplace and admin dashboard.`,createdAt:FieldValue.serverTimestamp()});
      return NextResponse.json({ok:true,deleted:ids.length});
    }

    if (body.resource === "auditLogs" && body.action === "clearAll") {
      await clearCollection("auditLogs");
      return NextResponse.json({ok:true});
    }
    if (body.resource === "auditLogs" && body.action === "deleteSelected") {
      const ids = body.ids || [];
      const batch = db.batch();
      for (const id of ids) batch.delete(db.collection("auditLogs").doc(id));
      await batch.commit();
      return NextResponse.json({ok:true});
    }

    const collections = {kyc:"kyc", listing:"listings", withdrawal:"withdrawals", order:"orders", ticket:"supportTickets", user:"users", report:"contentReports"} as const;
    const collection = collections[body.resource as keyof typeof collections];
    if (!collection) throw new Error("INVALID_RESOURCE");
    const ref = db.collection(collection).doc(body.id);
    const before = await ref.get();
    if (!before.exists) return NextResponse.json({error:"Record not found"},{status:404});
    const current = before.data() || {};
    let changes: Record<string,unknown> = {updatedAt: FieldValue.serverTimestamp()};
    let writtenInTransaction = false;

    if (body.resource === "kyc") {
      if (!['approve','reject','reupload'].includes(body.action)) throw new Error("INVALID_ACTION");
      const status = body.action === "approve" ? "approved" : body.action === "reupload" ? "reupload-required" : "rejected";
      changes = {...changes,status,reviewNote:body.note||"",reviewedBy:actingAdmin.email,reviewedAt:FieldValue.serverTimestamp()};
      const uid = String(current.userId || current.uid || body.id);
      await db.collection("users").doc(uid).set({kycStatus:status,kycReviewNote:body.note||"",kycReviewedAt:FieldValue.serverTimestamp()},{merge:true});
      const title = status === "approved" ? "KYC approved" : status === "rejected" ? "KYC rejected" : "KYC documents need updating";
      const message = status === "approved" ? "Your identity verification was approved. Your KYC verification is now active." : status === "rejected" ? `Your KYC application was rejected${body.note ? `: ${body.note}` : ". You can submit clearer documents."}` : `The administrator requested new KYC documents${body.note ? `: ${body.note}` : "."}`;
      await notifyUser({userId:uid,type:`kyc_${status}`,eventId:`${body.id}_${status}`,title,message,link:"/?kyc=1",email:true});
      if(body.action==="reupload"&&current.email){
        const appUrl=required("APP_URL"),reason=String(body.note||"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]||character));
        const result=await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(current.email),subject:"SaharaSnow requires updated KYC documents",html:`<div style="font-family:Arial,sans-serif;color:#17154a;max-width:620px;margin:auto;padding:24px"><img src="${appUrl}/logo.png" width="70" height="70" style="object-fit:contain" alt="SaharaSnow"><h1>Please upload your KYC documents again</h1><p>The administrator requires newer or clearer identity documents before your KYC can be approved.</p><div style="background:#f3f5fb;border-left:4px solid #ff6f61;padding:14px;margin:20px 0"><b>Administrator's reason:</b><br>${reason}</div><p><a href="${appUrl}/?kyc=reupload" style="display:inline-block;background:#075ee8;color:#fff;text-decoration:none;padding:12px 17px;border-radius:8px;font-weight:bold">Reupload KYC documents</a></p></div>`});
        if(result.error) console.error("KYC reupload email failed", result.error.message);
      }
    } else if (body.resource === "listing") {
      if (!['approve','reject','delete'].includes(body.action)) throw new Error("INVALID_ACTION");
      if(body.action==="approve"&&current.status==="awaiting-listing-fee")throw new Error("The seller must complete the listing-credit payment before this listing can be published.");
      if(body.action === "delete") {
        await ref.delete();
        if(current.sellerId) await notifyUser({userId:String(current.sellerId),type:"listing_deleted",eventId:body.id,title:"Listing removed",message:`Your listing "${String(current.title||"Service") }" was removed by the administrator${body.note ? `: ${body.note}` : "."}`,link:"/?services=1",email:true});
      } else {
        const status = body.action === "approve" ? "active" : "rejected";
        changes = {...changes,status,moderationNote:body.note||"",moderatedBy:actingAdmin.email};
        await ref.set(changes,{merge:true});
        if(current.sellerId) await notifyUser({userId:String(current.sellerId),type:`listing_${status}`,eventId:body.id,title:status === "active" ? "Listing approved" : "Listing rejected",message:status === "active" ? `Your listing "${String(current.title||"Service") }" is now published.` : `Your listing "${String(current.title||"Service") }" was rejected${body.note ? `: ${body.note}` : "."}`,link:status === "active" ? `/service/${String(current.subcategory||current.category||"service").toLowerCase().replace(/[^a-z0-9]+/g,"-")}/${body.id}` : "/?services=1",email:true});
        if(body.action === "approve" && current.sellerId) {
          const seller = (await db.collection("users").doc(String(current.sellerId)).get()).data() || {};
          if (seller.email) {
            const sellerName = [seller.firstName,seller.lastName].filter(Boolean).join(" ") || "seller";
            const slug = `${String(current.subcategory||current.category||"service")}-by-${sellerName}`.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
            const serviceUrl = `${required("APP_URL")}/service/${slug}/${body.id}`;
            const result = await new Resend(required("RESEND_API_KEY")).emails.send({from:required("EMAIL_FROM"),to:String(seller.email),subject:`Your SaharaSnow service is now published: ${String(current.title||"Service")}`,html:`<div style="font-family:Arial,sans-serif;color:#17154a;max-width:620px;margin:auto"><img src="${required("APP_URL")}/logo.png" alt="SaharaSnow" width="74" height="74" style="object-fit:contain"><h1>Your service is live</h1><p>Hello ${sellerName},</p><p>Your service <b>${String(current.title||"Service")}</b> has been approved and published on SaharaSnow.</p><p><a href="${serviceUrl}" style="display:inline-block;background:#ff6f61;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:bold">View your published service</a></p></div>`});
            if (result.error) console.error("Listing publication email failed", result.error.message);
            await ref.set({publicationEmailSentAt:FieldValue.serverTimestamp(),serviceUrl},{merge:true});
          }
        }
      }
    } else if (body.resource === "withdrawal") {
      if (!['paid','reject'].includes(body.action)) throw new Error("INVALID_ACTION");
      changes = {...changes,status:body.action === "paid" ? "paid-manually" : "rejected",adminNote:body.note||"",processedBy:actingAdmin.email,processedAt:FieldValue.serverTimestamp()};
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);
        const value=fresh.data()||{};
        if(["rejected","paid-manually"].includes(String(value.status)))throw new Error("Withdrawal already processed");
        tx.set(ref,changes,{merge:true});
        if(value.sellerId){
          const sellerRef=db.collection("users").doc(String(value.sellerId));
          if(body.action==="reject"&&Number(value.grossCents)>0){
            const rejectedBalanceField=String(value.currency||"").toUpperCase()==="USDC"?"usdcBalanceCents":"usdtBalanceCents";
            tx.set(sellerRef,{[rejectedBalanceField]:FieldValue.increment(Number(value.grossCents)),availableBalanceCents:FieldValue.increment(Number(value.grossCents)),pendingWithdrawalCents:0},{merge:true});
          }else if(body.action==="paid"){
            tx.set(sellerRef,{pendingWithdrawalCents:0,withdrawnCents:FieldValue.increment(Number(value.netCents||0))},{merge:true});
          }
        }
      });
      writtenInTransaction = true;
      if(current.sellerId) await notifyUser({userId:String(current.sellerId),type:`withdrawal_${body.action}`,eventId:body.id,title:body.action === "paid" ? "Withdrawal paid" : "Withdrawal rejected",message:body.action === "paid" ? `Your withdrawal of $${(Number(current.netCents||0)/100).toFixed(2)} was marked as paid by the administrator.` : `Your withdrawal was rejected${body.note ? `: ${body.note}` : ". The balance has been restored and is available for a new withdrawal request."}`,link:"/?seller=1",email:true});
    } else if (body.resource === "order") {
      if (!['release','refund','delete','resolve'].includes(body.action)) throw new Error("INVALID_ACTION");
      if(body.action === "delete") {
        await ref.delete();
        for(const uid of [current.buyerId,current.sellerId].filter(Boolean)) await notifyUser({userId:String(uid),type:"order_deleted",eventId:body.id,title:"Order/dispute removed",message:`Order #${String(current.orderNumber||body.id)} was removed from the administrator dashboard.${body.note ? ` ${body.note}` : ""}`});
      } else if (body.action === "resolve") {
        if (String(current.status) !== "disputed") throw new Error("Only disputed orders can be resolved with a split.");
        const totalCents = Number(current.serviceCents || 0);
        const sellerAmountCents = Math.round(Number(body.sellerAmount || 0) * 100);
        const buyerAmountCents = Math.round(Number(body.buyerAmount || 0) * 100);
        if (sellerAmountCents < 0 || buyerAmountCents < 0) throw new Error("Amounts cannot be negative.");
        if (sellerAmountCents + buyerAmountCents > totalCents) throw new Error("Seller + buyer amounts cannot exceed the order total.");
        const currencyLabel = String(current.paymentCurrency || "USDT");
        const status = sellerAmountCents > 0 ? "completed-released" : "refunded";
        changes = {...changes,status,resolutionNote:body.note||"",resolvedBy:actingAdmin.email,resolvedAt:FieldValue.serverTimestamp(),disputeResolution:{sellerAmountCents,buyerAmountCents,currency:currencyLabel,resolvedBy:actingAdmin.email,note:body.note||""}};
        await db.runTransaction(async tx=>{const fresh=await tx.get(ref);const value=fresh.data()||{};if(String(value.status)!=="disputed")throw new Error("This dispute was already resolved.");tx.set(ref,changes,{merge:true});if(sellerAmountCents>0&&value.sellerId)tx.set(db.collection("users").doc(String(value.sellerId)),{availableBalanceCents:FieldValue.increment(sellerAmountCents)},{merge:true});});
        writtenInTransaction = true;
        if(current.buyerId) await notifyUser({userId:String(current.buyerId),type:"dispute_resolved",eventId:body.id,title:"Dispute resolved",message:`Order #${String(current.orderNumber||body.id)} dispute resolved: ${(sellerAmountCents/100).toFixed(2)} ${currencyLabel} to the seller, ${(buyerAmountCents/100).toFixed(2)} ${currencyLabel} refunded to you.${body.note?` Note: ${body.note}`:""}`,link:`/?order=${body.id}`,email:true});
        if(current.sellerId) await notifyUser({userId:String(current.sellerId),type:"dispute_resolved",eventId:body.id,title:"Dispute resolved",message:`Order #${String(current.orderNumber||body.id)} dispute resolved: ${(sellerAmountCents/100).toFixed(2)} ${currencyLabel} released to your balance, ${(buyerAmountCents/100).toFixed(2)} ${currencyLabel} refunded to the buyer.${body.note?` Note: ${body.note}`:""}`,link:"/?seller=1",email:true});
        if(current.buyerId&&current.sellerId) await postSystemMessage({buyerId:String(current.buyerId),sellerId:String(current.sellerId),orderId:body.id,text:`⚖️ Dispute resolved by administrator for order #${String(current.orderNumber||body.id)}: ${(sellerAmountCents/100).toFixed(2)} ${currencyLabel} to seller, ${(buyerAmountCents/100).toFixed(2)} ${currencyLabel} refunded to buyer.${body.note?` Note: ${body.note}`:""}`});
      } else {
        changes = {...changes,status:body.action === "release" ? "completed-released" : "refunded",resolutionNote:body.note||"",resolvedBy:actingAdmin.email,resolvedAt:FieldValue.serverTimestamp()};
        await db.runTransaction(async tx=>{const fresh=await tx.get(ref);const value=fresh.data()||{};if(["completed-released","refunded"].includes(String(value.status)))throw new Error("Order already resolved");tx.set(ref,changes,{merge:true});if(body.action==="release"&&value.sellerId&&Number(value.sellerNetCents ?? value.serviceCents)>0)tx.set(db.collection("users").doc(String(value.sellerId)),{availableBalanceCents:FieldValue.increment(Number(value.sellerNetCents ?? value.serviceCents))},{merge:true});});
        writtenInTransaction = true;
        if(current.buyerId) await notifyUser({userId:String(current.buyerId),type:`order_${body.action}`,eventId:body.id,title:body.action === "release" ? "Order completed" : "Order refunded",message:body.action === "release" ? `Order #${String(current.orderNumber||body.id)} has been released and completed.` : `Order #${String(current.orderNumber||body.id)} was marked refunded${body.note ? `: ${body.note}` : "."}`,link:`/?order=${body.id}`,email:true});
        if(current.sellerId) await notifyUser({userId:String(current.sellerId),type:`order_${body.action}`,eventId:body.id,title:body.action === "release" ? "Earnings released" : "Order refunded",message:body.action === "release" ? `Order #${String(current.orderNumber||body.id)} was released. ${((Number(current.sellerNetCents ?? current.serviceCents)||0)/100).toFixed(2)} USD has been added to your seller earnings.` : `Order #${String(current.orderNumber||body.id)} was refunded, so no seller earnings were released.`,link:"/?seller=1",email:true});
        if(current.buyerId&&current.sellerId) await postSystemMessage({buyerId:String(current.buyerId),sellerId:String(current.sellerId),orderId:body.id,text:body.action==="release"?`✅ Order #${String(current.orderNumber||body.id)} was released and marked complete by an administrator.`:`↩️ Order #${String(current.orderNumber||body.id)} was refunded by an administrator.${body.note?` Note: ${body.note}`:""}`});
      }
    } else if (body.resource === "ticket") {
      if (body.action !== "close") throw new Error("INVALID_ACTION");
      changes = {...changes,status:"closed",adminNote:body.note||"",closedBy:actingAdmin.email,closedAt:FieldValue.serverTimestamp()};
    } else if (body.resource === "report") {
      if (body.action !== "delete") throw new Error("INVALID_ACTION");
      await ref.delete();
    } else if (body.resource === "user") {
      if (!['suspend','restore','resetPhone','restoreKyc'].includes(body.action)) throw new Error("INVALID_ACTION");
      if (body.action === "resetPhone") {
        changes = {...changes,phoneVerified:false,phoneNumber:FieldValue.delete(),adminNote:body.note||""};
        try { await adminAuth.updateUser(body.id, {phoneNumber:null}); } catch {}
        await notifyUser({userId:body.id,type:"phone_reset",eventId:`${body.id}_phone_reset_${Date.now()}`,title:"Phone number reset",message:`An administrator reset your verified phone number${body.note ? `: ${body.note}` : "."} Verify a new number before your next withdrawal.`,link:"/?seller=1",email:true});
      } else if (body.action === "restoreKyc") {
        changes = {...changes,kycStatus:"approved",kycReviewNote:body.note||"Restored by administrator after document review.",kycReviewedBy:actingAdmin.email,kycReviewedAt:FieldValue.serverTimestamp(),adminNote:body.note||""};
        await notifyUser({userId:body.id,type:"kyc_restored",eventId:`${body.id}_kyc_restored_${Date.now()}`,title:"KYC verification restored",message:`Your KYC verification was restored by an administrator${body.note ? `: ${body.note}` : "."}`,link:"/?kyc=1",email:true});
      } else {
        const suspended = body.action === "suspend";
        changes = {...changes,accountStatus:suspended ? "suspended" : "active",adminNote:body.note||""};
        await adminAuth.updateUser(body.id, {disabled:suspended});
        if (suspended) {
          await db.collection("loginCodes").doc(String(current.email || "").toLowerCase()).delete();
          await adminAuth.revokeRefreshTokens(body.id);
        }
      }
    }

    if (!writtenInTransaction && body.resource !== "listing" && body.resource !== "order" && body.resource !== "report") await ref.set(changes,{merge:true});
    await db.collection("auditLogs").add({adminUid:actingAdmin.uid,adminEmail:actingAdmin.email,resource:body.resource,resourceId:body.id,action:body.action,note:body.note||"",createdAt:FieldValue.serverTimestamp()});
    return NextResponse.json({ok:true});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin action failed";
    const forbidden = message === "ADMIN_FORBIDDEN" || message === "UNAUTHENTICATED";
    return NextResponse.json({error:forbidden ? "Administrator access required." : message},{status:forbidden?403:400});
  }
}
