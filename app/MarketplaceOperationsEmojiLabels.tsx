"use client";

import {useEffect} from "react";

const icons=["🛒","📝","🛡️","⚖️","🌙","😍","❤️","📜","🔒","⚙️"];

export default function MarketplaceOperationsEmojiLabels(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLButtonElement>(".protection .toolGrid>button").forEach((button,index)=>{
        const marker=button.querySelector<HTMLElement>("span");
        if(!marker)return;
        const icon=icons[index];
        if(icon && marker.textContent!==icon)marker.textContent=icon;
        button.setAttribute("aria-disabled","true");
        button.tabIndex=-1;
      });
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
