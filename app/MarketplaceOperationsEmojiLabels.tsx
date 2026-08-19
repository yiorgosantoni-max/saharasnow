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
        if(icon)marker.textContent=icon;
        button.setAttribute("aria-disabled","true");
        button.tabIndex=-1;
      });
    };
    apply();
    window.addEventListener("pageshow",apply);
    return()=>window.removeEventListener("pageshow",apply);
  },[]);
  return null;
}
