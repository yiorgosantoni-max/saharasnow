"use client";

import {useEffect} from "react";

export default function NavigationFreshness(){
 useEffect(()=>{
  const reloadCurrentPage=()=>{
   const key=`saharasnow:fresh:${location.href}`;
   if(sessionStorage.getItem(key)) return;
   sessionStorage.setItem(key,"1");
   location.reload();
  };
  const onPageShow=(event:PageTransitionEvent)=>{
   if(event.persisted) reloadCurrentPage();
  };
  const onPopState=()=>reloadCurrentPage();
  window.addEventListener("pageshow",onPageShow);
  window.addEventListener("popstate",onPopState);
  return()=>{
   window.removeEventListener("pageshow",onPageShow);
   window.removeEventListener("popstate",onPopState);
  };
 },[]);
 return null;
}
