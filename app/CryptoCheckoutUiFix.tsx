"use client";
import {useEffect} from "react";

export default function CryptoCheckoutUiFix(){
 useEffect(()=>{
  let dead=false;
  const apply=()=>{
   if(dead)return;
   document.querySelectorAll<HTMLElement>('[aria-label$="payment"] header > div:first-child').forEach(badge=>{
    const text=(badge.textContent||"").trim();
    if(text.startsWith("● Secure ")) badge.textContent=text.replace(/^● Secure /,"🔒 Secure ");
   });
  };
  apply();
  const observer=new MutationObserver(apply);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  return()=>{dead=true;observer.disconnect()};
 },[]);
 return null;
}
