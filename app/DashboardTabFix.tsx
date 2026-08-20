"use client";
import {useEffect} from "react";

const labels=new Set(["profile","earnings","my services","kyc verification","notifications","inbox","orders & invoices","custom offers","delivery"]);

export default function DashboardTabFix(){
  useEffect(()=>{
    let dead=false;
    const restore=(panel:HTMLElement|null)=>{
      const content=panel?.nextElementSibling as HTMLElement|null;
      if(content?.dataset.saharaHiddenForCustomOffers==="1"){
        content.style.removeProperty("display");
        delete content.dataset.saharaHiddenForCustomOffers;
      }
    };
    const sync=()=>{
      if(dead)return;
      document.querySelectorAll<HTMLElement>(".saharaTabNav").forEach(nav=>{
        const strip=nav.querySelector<HTMLElement>(".saharaTabStrip");
        if(!strip)return;
        const tabs=Array.from(strip.querySelectorAll<HTMLElement>("button,a,[role='tab'],[role='link']")).filter(el=>labels.has((el.innerText||"").trim().toLowerCase()));
        const notification=tabs.find(el=>(el.innerText||"").trim().toLowerCase()==="notifications");
        if(!notification)return;
        const reference=getComputedStyle(notification);
        const modal=nav.parentElement;
        tabs.forEach(tab=>{
          tab.style.setProperty("height",reference.height,"important");
          tab.style.setProperty("min-height",reference.minHeight,"important");
          tab.style.setProperty("padding-top",reference.paddingTop,"important");
          tab.style.setProperty("padding-right",reference.paddingRight,"important");
          tab.style.setProperty("padding-bottom",reference.paddingBottom,"important");
          tab.style.setProperty("padding-left",reference.paddingLeft,"important");
          tab.style.setProperty("margin-top",reference.marginTop,"important");
          tab.style.setProperty("margin-right",reference.marginRight,"important");
          tab.style.setProperty("margin-bottom",reference.marginBottom,"important");
          tab.style.setProperty("margin-left",reference.marginLeft,"important");
          tab.style.setProperty("box-sizing","border-box","important");
          tab.style.setProperty("line-height",reference.lineHeight,"important");
          tab.style.setProperty("font-size",reference.fontSize,"important");
        });
        if(modal && !(modal as HTMLElement).dataset.saharaDashboardFixBound){
          (modal as HTMLElement).dataset.saharaDashboardFixBound="1";
          modal.addEventListener("click",event=>{
            const target=event.target as HTMLElement|null;
            const tab=target?.closest<HTMLElement>("button,a,[role='tab'],[role='link']");
            if(!tab||!labels.has((tab.innerText||"").trim().toLowerCase()))return;
            const label=(tab.innerText||"").trim().toLowerCase();
            const panel=modal.querySelector<HTMLElement>(".saharaCustomPanel");
            if(label==="custom offers"||label==="delivery"){
              const content=panel?.nextElementSibling as HTMLElement|null;
              if(content){content.style.setProperty("display","none","important");content.dataset.saharaHiddenForCustomOffers="1";}
            }else restore(panel);
          },true);
        }
      });
    };
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("pageshow",sync);
    return()=>{dead=true;observer.disconnect();window.removeEventListener("pageshow",sync)};
  },[]);
  return null;
}
