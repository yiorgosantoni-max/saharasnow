import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { db } from "./firebase-admin";
import { required } from "./server";

export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  eventId?: string;
  email?: boolean;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c] || c));
const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);

export async function notifyUser(input: NotificationInput) {
  const eventId = input.eventId || `${input.type}_${Date.now()}`;
  const id = safeId(`${input.userId}_${input.type}_${eventId}`);
  const ref = db.collection("notifications").doc(id);
  const existing = await ref.get();
  if (!existing.exists) {
    await ref.set({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link || null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (input.email) {
    const profile = (await db.collection("users").doc(input.userId).get()).data() || {};
    if (profile.email) {
      try {
        const appUrl = required("APP_URL");
        const result = await new Resend(required("RESEND_API_KEY")).emails.send({
          from: required("EMAIL_FROM"),
          to: String(profile.email),
          subject: `SaharaSnow — ${input.title}`,
          html: `<div style="font-family:Arial,sans-serif;color:#17154a;max-width:650px;margin:auto;padding:24px"><img src="${appUrl}/logo.png" width="70" height="70" alt="SaharaSnow"><h1>${escapeHtml(input.title)}</h1><p>${escapeHtml(input.message)}</p>${input.link ? `<p><a href="${appUrl}${input.link}" style="display:inline-block;background:#ff6f61;color:#fff;text-decoration:none;padding:12px 17px;border-radius:8px;font-weight:bold">Open SaharaSnow</a></p>` : ""}<p style="font-size:11px;color:#8a8796">You can also find this notification in your SaharaSnow account.</p></div>`,
        });
        if (result.error) console.error("Notification email failed", result.error.message);
      } catch (error) {
        console.error("Notification email failed", error instanceof Error ? error.message : error);
      }
    }
  }
  return id;
}

export async function notifyAdminInApp(input: Omit<NotificationInput, "userId">) {
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || "yiorgosantoni@gmail.com").toLowerCase();
  const snap = await db.collection("users").where("email", "==", adminEmail).limit(1).get();
  if (snap.empty) return;
  await notifyUser({ ...input, userId: snap.docs[0].id });
}
