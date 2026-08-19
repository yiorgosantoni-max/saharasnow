"use client";

import {useEffect} from "react";

/**
 * Prevent stale browser BFCache / Next client-router snapshots from being
 * shown after Back/Forward navigation. Marketplace data is live, so history
 * restores must always perform a real document reload.
 */
export default function NavigationFreshness(){
 useEffect(()=>{
  let reloading=false;
  const reloadCurrentPage=()=>{
   if(reloading) return;
   reloading=true;
   // Do not use sessionStorage/localStorage as a throttle: the same URL can
   // legitimately be visited repeatedly and must be fresh every time.
   location.reload();
  };
  const onPageShow=(event:PageTransitionEvent)=>{
   // `persisted` means the browser restored the page from BFCache.
   if(event.persisted) reloadCurrentPage();
  };
  const onPopState=()=>{
   // Next/browser history can restore an old RSC/client snapshot even when
   // the page was not BFCache-persisted. Reload after the URL has settled.
   window.setTimeout(reloadCurrentPage,0);
  };
  window.addEventListener("pageshow",onPageShow);
  window.addEventListener("popstate",onPopState);
  return()=>{
   window.removeEventListener("pageshow",onPageShow);
   window.removeEventListener("popstate",onPopState);
  };
 },[]);
 return null;
}
