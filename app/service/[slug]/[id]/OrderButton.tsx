"use client";
import {useEffect,useState} from "react";
import {onAuthStateChanged} from "firebase/auth";
import {getClientAuth} from "@/lib/firebase-client";

export default function OrderButton({listingId,packageIndex=0,packageName}:{listingId:string;packageIndex?:number;packageName?:string}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[authReady,setAuthReady]=useState(false),[signedIn,setSignedIn]=useState(false);
  useEffect(()=>onAuthStateChanged(getClientAuth(),user=>{setSignedIn(Boolean(user));setAuthReady(true)}),[]);
  const order=async()=>{const user=getClientAuth().currentUser;if(!user){sessionStorage.setItem("saharasnow_return_to",window.location.pathname);window.location.href="/?signin=1";return}setBusy(true);setError("");try{const token=await user.getIdToken(true);const response=await fetch("/api/stripe/checkout",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId,packageIndex})});const text=await response.text();const data=text?JSON.parse(text):{};if(!response.ok)throw new Error(data.error||"Unable to start checkout");if(!data.url)throw new Error("Stripe Checkout did not return a payment URL");window.location.href=data.url}catch(error){setError(error instanceof Error?error.message:"Unable to start checkout");setBusy(false)}};
  return <div><button onClick={order} disabled={busy||!authReady}>{!authReady?"Checking sign-in…":busy?"Opening secure checkout…":signedIn?`Continue with ${packageName||"this service"}`:`Sign in to choose ${packageName||"this service"}`}</button>{error&&<p>{error}</p>}</div>;
}
