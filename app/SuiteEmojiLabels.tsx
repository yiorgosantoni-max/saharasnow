"use client";
import {useEffect} from "react";

const icons:Record<string,string>={
  "01":"💵","02":"🌐","03":"🏅","04":"📦","05":"🎯","06":"💝","07":"🏷️","08":"🛟","09":"📚","10":"📱","11":"🧾","12":"📊","13":"🛒","14":"♿","15":"🍪","16":"🛠️","17":"📜"
};

export default function SuiteEmojiLabels(){
  useEffect(()=>{
    const apply=()=>{
      document.querySelectorAll<HTMLButtonElement>(".growthSuite .suiteNav button").forEach(button=>{
        const span=button.querySelector<HTMLSpanElement>("span");
        if(!span)return;
        const raw=span.dataset.suiteId||span.textContent?.trim()||"";
        if(!span.dataset.suiteId)span.dataset.suiteId=raw;
        const icon=icons[raw];
        if(!icon)return;
        span.textContent=icon;
        span.style.fontSize="22px";
        span.style.lineHeight="1";
        span.style.letterSpacing="0";
        span.style.fontWeight="400";
      });
    };
    apply();
    window.addEventListener("pageshow",apply);
    return()=>window.removeEventListener("pageshow",apply);
  },[]);
  return null;
}
