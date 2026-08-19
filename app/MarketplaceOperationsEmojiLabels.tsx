"use client";
import {useEffect} from "react";

const icons=["🛒","📝","🛡️","⚖️","🌙","😍","❤️","📜","🔒","⚙️"];

export default function MarketplaceOperationsEmojiLabels(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLElement>(".protection .toolGrid>button").forEach((button,index)=>{
        const marker=button.querySelector<HTMLElement>("span");
        if(!marker)return;
        marker.textContent=icons[index]||"✨";
        marker.style.cssText="font-size:22px!important;line-height:1!important;letter-spacing:0!important;font-weight:400!important";
        button.setAttribute("aria-disabled","true");
        button.tabIndex=-1;
      });
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    window.addEventListener("pageshow",apply);
    window.addEventListener("popstate",apply);
    window.addEventListener("sahara-layout-restore",apply);
    return()=>{observer.disconnect();window.removeEventListener("pageshow",apply);window.removeEventListener("popstate",apply);window.removeEventListener("sahara-layout-restore",apply);};
  },[]);
  return null;
}
