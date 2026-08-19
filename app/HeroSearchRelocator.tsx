"use client";
import {useEffect} from "react";

export default function HeroSearchRelocator(){
  useEffect(()=>{
    if(location.pathname!=="/")return;
    const relocate=()=>{
      const bar=document.getElementById("saharasnow-service-filters");
      const heroText=document.querySelector<HTMLElement>(".hero .heroText");
      const oldSearch=heroText?.querySelector<HTMLElement>(".search");
      if(oldSearch)oldSearch.style.display="none";
      if(bar&&heroText){
        const popular=heroText.querySelector<HTMLElement>(".popular");
        if(bar.parentElement!==heroText)heroText.insertBefore(bar,popular||null);
      }
    };
    relocate();
    const observer=new MutationObserver(relocate);
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("pageshow",relocate);
    return()=>{observer.disconnect();window.removeEventListener("pageshow",relocate)};
  },[]);
  return null;
}
