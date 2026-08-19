"use client";
import {useEffect} from "react";

const icons:Record<string,string>={"01":"💵","02":"🌐","03":"🏅","04":"📦","05":"🎯","06":"💝","07":"🏷️","08":"🛟","09":"📚","10":"📱","11":"🧾","12":"📊","13":"🛒","14":"♿","15":"🍪","16":"🛠️","17":"📜"};

export default function SuiteEmojiLabels(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLElement>(".growthSuite .suiteNav button").forEach(button=>{
        const span=button.querySelector<HTMLSpanElement>("span");
        if(!span)return;
        const raw=span.dataset.suiteId||span.textContent?.trim()||"";
        if(!span.dataset.suiteId)span.dataset.suiteId=raw;
        const icon=icons[raw];
        if(!icon)return;
        span.textContent=icon;
        span.style.cssText="font-size:22px!important;line-height:1!important;letter-spacing:0!important;font-weight:400!important";
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
