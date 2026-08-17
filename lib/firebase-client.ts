"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { Auth, browserLocalPersistence, getAuth, initializeAuth, onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { getStorage } from "firebase/storage";

const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID};
function clientApp(){if(typeof window==="undefined")throw new Error("Firebase client is only available in the browser");if(getApps().length)return getApp();return config.apiKey?initializeApp(config):initializeApp();}
let cachedAuth:Auth|undefined;
export const getClientAuth=()=>{if(cachedAuth)return cachedAuth;const app=clientApp();try{cachedAuth=initializeAuth(app,{persistence:browserLocalPersistence})}catch{cachedAuth=getAuth(app)}return cachedAuth;};
export const getClientStorage=()=>getStorage(clientApp());
export const observeAuth=(callback:(signedIn:boolean,email?:string)=>void)=>onAuthStateChanged(getClientAuth(),user=>callback(Boolean(user),user?.email??undefined));
export const signOutUser=()=>signOut(getClientAuth());

export type AuthPurpose="login"|"register";
export async function requestLoginCode(email:string,purpose:AuthPurpose="login"){const response=await fetch("/api/auth/request-code",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,purpose})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to send code");}
export async function verifyLoginCode(email:string,code:string,purpose:AuthPurpose="login"){const response=await fetch("/api/auth/verify-code",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email,code,purpose})});const text=await response.text();let data:{error?:string;customToken?:string}={};try{data=text?JSON.parse(text):{};}catch{throw new Error(`Verification service returned an invalid response (${response.status})`);}if(!response.ok)throw new Error(data.error||`Unable to verify code (${response.status})`);if(!data.customToken)throw new Error("Verification completed without a sign-in token");return signInWithCustomToken(getClientAuth(),data.customToken);}
