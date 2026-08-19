"use client";

import {useEffect} from "react";

/**
 * Never allow the browser, Next router, or BFCache to display an old restored
 * homepage after Back/Forward navigation. A history restore reloads the current
 * URL once, so the latest deployed markup and client code are used.
 */
export default function HistoryRestoreGuard(){
  useEffect(()=>{
    const restore=()=>{
      if(location.pathname!=="/")return;
      const key=`sahara-history-reload:${location.href}`;
      const now=Date.now();
      const previous=Number(sessionStorage.getItem(key)||0);
      if(now-previous<1500)return;
      sessionStorage.setItem(key,String(now));
      location.reload();
    };
    const onPageShow=(event:PageTransitionEvent)=>{
      if(event.persisted)restore();
      else window.dispatchEvent(new Event("sahara-layout-restore"));
    };
    const onPopState=()=>restore();
    const onHashChange=()=>window.dispatchEvent(new Event("sahara-layout-restore"));
    window.addEventListener("pageshow",onPageShow);
    window.addEventListener("popstate",onPopState);
    window.addEventListener("hashchange",onHashChange);
    return()=>{
      window.removeEventListener("pageshow",onPageShow);
      window.removeEventListener("popstate",onPopState);
      window.removeEventListener("hashchange",onHashChange);
    };
  },[]);
  return null;
}
