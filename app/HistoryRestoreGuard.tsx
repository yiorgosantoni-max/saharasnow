"use client";

import {useEffect} from "react";

/**
 * Browser Back/Forward can restore an old homepage from the back-forward cache.
 * Reload only a persisted homepage restore so the current service-card markup,
 * USD pricing and current client code are used instead of stale cached DOM.
 */
export default function HistoryRestoreGuard(){
  useEffect(()=>{
    const onPageShow=(event:PageTransitionEvent)=>{
      if(event.persisted&&location.pathname==="/")location.reload();
    };
    window.addEventListener("pageshow",onPageShow);
    return()=>window.removeEventListener("pageshow",onPageShow);
  },[]);
  return null;
}
