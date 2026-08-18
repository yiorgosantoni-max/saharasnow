"use client";
import {useEffect} from "react";
import {getClientAuth} from "@/lib/firebase-client";

export default function MarketplaceCardActions(){
 useEffect(()=>{
  const saved=new Set<string>();
  let loadedFor="";
  const load=async()=>{
   const user=getClientAuth().currentUser;if(!user){saved.clear();loadedFor="";paint();return;}
   if(loadedFor===user.uid)return;loadedFor=user.uid;
   try{const token=await user.getIdToken();const r=await fetch("/api/favorites",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});const d=await r.json();saved.clear();for(const item of d.favorites||[])if(item?.id)saved.add(String(item.id));paint();}catch{loadedFor="";}
  };
  const idFrom=(button:Element)=>button.closest<HTMLElement>("article[id^='service-']")?.id.replace(/^service-/,"")||"";
  const paint=()=>document.querySelectorAll<HTMLButtonElement>(".visual .favouriteButton").forEach(button=>{const id=idFrom(button);const isSaved=saved.has(id);button.textContent=isSaved?"♥":"♡";button.setAttribute("aria-pressed",String(isSaved));button.setAttribute("aria-label",isSaved?"Remove from favourites":"Save service to favourites");button.style.display="inline-flex";button.style.visibility="visible";button.style.opacity="1";});
  const toggle=async(button:HTMLButtonElement)=>{
   const id=idFrom(button);if(!id)return;const user=getClientAuth().currentUser;if(!user){window.location.assign("/?signin=1");return;}
   button.disabled=true;try{const token=await user.getIdToken(true);const removing=saved.has(id);const r=await fetch("/api/favorites",{method:removing?"DELETE":"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to update favourite");if(d.saved===false||removing)saved.delete(id);else saved.add(id);paint();document.dispatchEvent(new CustomEvent("saharasnow:favorites-changed"));}catch(error){alert(error instanceof Error?error.message:"Unable to update favourite");}finally{button.disabled=false;}
  };
  const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target:null;const button=target?.closest<HTMLButtonElement>(".visual .favouriteButton");if(!button)return;event.preventDefault();event.stopPropagation();void toggle(button);};
  document.addEventListener("click",click,true);load();const observer=new MutationObserver(()=>{paint();void load();});observer.observe(document.body,{childList:true,subtree:true});return()=>{document.removeEventListener("click",click,true);observer.disconnect();};
 },[]);
 return null;
}
