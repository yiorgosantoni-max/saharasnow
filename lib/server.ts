export const SIGNUP_SLOT_CAP = 300;
/**
 * Signup slots are capped per calendar month. Rather than resetting a shared
 * counter on a schedule (which needs a cron job and can fire late, early or
 * twice), the counter document is keyed by month: "2026-08", "2026-09", ...
 * A new month therefore starts at zero automatically with no moving parts.
 * Months are computed in UTC so the rollover moment is unambiguous.
 */
export function signupSlotPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Read-only check of how many slots are left this month. Not transactional — use claimSignupSlot() for the authoritative, race-safe reservation. */
export async function signupSlotsRemaining() {
  const { db } = await import("./firebase-admin");
  const snap = await db.collection("meta").doc(`signupSlots-${signupSlotPeriod()}`).get();
  const used = Number(snap.data()?.usedSlots || 0);
  return Math.max(0, SIGNUP_SLOT_CAP - used);
}

/** Atomically reserves one of this month's SIGNUP_SLOT_CAP signup slots. Throws if none remain. */
export async function claimSignupSlot(uid: string) {
  const { db } = await import("./firebase-admin");
  const period = signupSlotPeriod();
  const ref = db.collection("meta").doc(`signupSlots-${period}`);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const used = Number(snap.data()?.usedSlots || 0);
    if (used >= SIGNUP_SLOT_CAP) throw new Error(`Registration is full for this month — all ${SIGNUP_SLOT_CAP} places have been taken. New places open on the 1st.`);
    tx.set(ref, { period, usedSlots: used + 1, lastClaimedBy: uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return used + 1;
  });
}
