import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin";

export type SystemAttachment = { name: string; url: string; size: number; type?: string };

/**
 * Posts an order-related notice straight into the buyer/seller conversation,
 * bypassing the KYC gate on the user-facing messages endpoint since this is
 * a system notice about an order both parties already share, not a cold DM.
 */
export async function postSystemMessage(input: {
  buyerId: string;
  sellerId: string;
  text: string;
  orderId?: string;
  attachments?: SystemAttachment[];
}) {
  const { buyerId, sellerId, text, orderId, attachments = [] } = input;
  if (!buyerId || !sellerId || buyerId === sellerId) return;
  const conversationId = [buyerId, sellerId].sort().join("_");
  const conversationRef = db.collection("conversations").doc(conversationId);
  await conversationRef.set({ participants: [buyerId, sellerId], updatedAt: FieldValue.serverTimestamp(), lastMessage: text.slice(0, 160), lastSenderId: "system" }, { merge: true });
  await conversationRef.collection("messages").add({ senderId: "system", text, orderId: orderId ?? null, attachments, createdAt: FieldValue.serverTimestamp() });
}
