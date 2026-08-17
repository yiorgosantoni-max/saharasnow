import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`
    : undefined);

const app = getApps()[0] ?? initializeApp({
  credential: applicationDefault(),
  ...(storageBucket ? { storageBucket } : {}),
});

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
export const adminStorage = getStorage(app);
