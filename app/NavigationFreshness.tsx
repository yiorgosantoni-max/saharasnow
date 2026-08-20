"use client";

import {useEffect} from "react";

/**
 * Back/Forward must never revive an old Next.js router or BFCache snapshot.
 * A history restore is redirected to a unique request URL, which guarantees a
 * fresh document/RSC request instead of reusing the previous history entry.
 */
export default function NavigationFreshness(){
 useEffect(()=>{
  let navigating=false;
  const freshNavigate=()=>{
   if(navigating) return;
   navigating=true;
   const url=new URL(window.location.href);
   url.searchParams.set("__nav",`${Date.now()}-${Math.random().toString(36).slice(2)}`);
   window.location.replace(url.toString());
  };
  const onPageShow=(event:PageTransitionEvent)=>{
   if(event.persisted) freshNavigate();
  };
  const onPopState=()=>window.setTimeout(freshNavigate,0);
  window.addEventListener("pageshow",onPageShow);
  window.addEventListener("popstate",onPopState);
  return()=>{
   window.removeEventListener("pageshow",onPageShow);
   window.removeEventListener("popstate",onPopState);
  };
 },[]);
 useEffect(()=>{
  // Keep the visible URL clean after the fresh navigation without creating a
  // second history entry. The page data has already been loaded from the
  // unique request URL.
  const url=new URL(window.location.href);
  if(url.searchParams.has("__nav")){
   url.searchParams.delete("__nav");
   window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
  }
 },[]);
 return null;
}
