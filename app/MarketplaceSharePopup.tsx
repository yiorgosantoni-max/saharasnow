"use client";
import {useEffect} from "react";

type ShareKind="facebook"|"linkedin"|"x"|"whatsapp"|"copy";
type Counts={shareCount:number;favoriteCount:number};

function tier(orderCount:number){
 if(orderCount>=201)return {text:"🏆 Top Seller",cls:"top"};
 if(orderCount>=51)return {text:"😍 Client Favourite",cls:"client"};
 if(orderCount>=1)return {text:"🌱 New Seller",cls:"new"};
 return null;
}

export default function MarketplaceSharePopup(){
 useEffect(()=>{
  let activeId="",activeTitle="",activeUrl="";
  const style=document.createElement("style");
  style.dataset.marketplaceSharePopup="true";
  style.textContent=`
   [data-sahara-service-actions],.sahara-card-share-row{display:none!important}
   .sahara-detail-share-row{display:flex;align-items:center;gap:8px;margin-top:22px;padding-top:9px;border-top:1px solid rgba(0,0,0,.09);font-size:12px;position:relative;z-index:30}
   .sahara-card-share-count{color:#667085;white-space:nowrap}.sahara-card-share-open{margin-left:auto;width:38px;height:38px;border:1px solid #d0d5dd;border-radius:11px;background:#fff;color:#344054;font-size:20px;cursor:pointer;touch-action:manipulation}
   .sahara-detail-seller-badge{display:inline-flex;align-items:center;width:max-content;margin:7px 0 0;border-radius:5px;padding:5px 8px;font-size:11px;font-weight:800;line-height:1.1}
   .sahara-detail-seller-badge.new{background:#eaf7ee;color:#247342}.sahara-detail-seller-badge.client{background:#fff0df;color:#9b5a14}.sahara-detail-seller-badge.top{background:#fff1cf;color:#855b00}
   .sahara-share-layer{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.38);backdrop-filter:blur(2px)}.sahara-share-layer.open{display:flex}
   .sahara-share-box{width:min(620px,100%);background:#fff;border-radius:16px;padding:26px 32px 28px;box-shadow:0 24px 70px rgba(15,23,42,.28);position:relative;text-align:center;color:#475467}.sahara-share-box h2{margin:0;font-size:27px}.sahara-share-box p{margin:10px 0 24px;color:#667085}
   .sahara-share-close{position:absolute;right:16px;top:12px;border:0;background:transparent;font-size:30px;color:#98a2b3;cursor:pointer}
   .sahara-share-options{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}.sahara-share-option{width:82px;border:0;background:transparent;cursor:pointer;color:#475467;display:flex;flex-direction:column;align-items:center;gap:9px;font:inherit}.sahara-share-option b{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:27px;box-shadow:0 4px 12px rgba(15,23,42,.14)}
   .sahara-share-option[data-share=facebook] b{background:#4267a9}.sahara-share-option[data-share=linkedin] b{background:#0a66c2;font-size:22px}.sahara-share-option[data-share=x] b{background:#111}.sahara-share-option[data-share=whatsapp] b{background:#169c36}.sahara-share-option[data-share=copy] b{background:#fff;color:#344054;border:1px solid #d0d5dd}
   .sahara-share-note{margin-top:25px;padding:14px 16px;background:#eef3ff;border-radius:8px;text-align:left;font-size:14px}.sahara-share-note strong{color:#4267a9}
   @media(max-width:520px){.sahara-share-box{padding:24px 16px}.sahara-share-options{gap:10px}.sahara-share-option{width:64px}.sahara-share-option b{width:50px;height:50px}.sahara-share-box h2{font-size:23px}}
  `;
  if(!document.querySelector("style[data-marketplace-share-popup]"))document.head.appendChild(style);

  const layer=document.createElement("div");
  layer.className="sahara-share-layer";
  layer.setAttribute("aria-hidden","true");
  layer.innerHTML=`<div class="sahara-share-box" role="dialog" aria-modal="true"><button class="sahara-share-close" type="button" aria-label="Close sharing popup">×</button><div style="font-size:34px;margin-bottom:10px">↗</div><h2>Sharing is caring</h2><p>Inspire people by sharing this service</p><div class="sahara-share-options"><button class="sahara-share-option" data-share="facebook" type="button"><b>f</b><span>Facebook</span></button><button class="sahara-share-option" data-share="linkedin" type="button"><b>in</b><span>LinkedIn</span></button><button class="sahara-share-option" data-share="x" type="button"><b>𝕏</b><span>X</span></button><button class="sahara-share-option" data-share="whatsapp" type="button"><b>◔</b><span>WhatsApp</span></button><button class="sahara-share-option" data-share="copy" type="button"><b>↗</b><span>Copy Link</span></button></div><div class="sahara-share-note"><strong>● Note:</strong> A share is counted only when a social network share option is selected. Opening this popup or copying the link does not add a share.</div></div>`;
  document.body.appendChild(layer);

  const close=()=>{layer.classList.remove("open");layer.setAttribute("aria-hidden","true");activeId="";activeTitle="";activeUrl="";};
  const detailId=()=>{const match=window.location.pathname.match(/^\/service\/[^/]+\/([^/]+)\/?$/);return match?decodeURIComponent(match[1]):"";};
  const update=(id:string,next:Partial<Counts>)=>document.querySelectorAll<HTMLElement>(`[data-share-count-id="${CSS.escape(id)}"]`).forEach(element=>{
   const previous=element.dataset.counts?JSON.parse(element.dataset.counts) as Counts:{shareCount:0,favoriteCount:0};
   const value={...previous,...next};element.dataset.counts=JSON.stringify(value);element.textContent=`${value.shareCount} shares · ${value.favoriteCount} favourites`;
  });
  const loadCounts=async(id:string)=>{try{const response=await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(id)}`,{cache:"no-store"});if(response.ok){const data=await response.json() as Partial<Counts>;update(id,{shareCount:Number(data.shareCount||0),favoriteCount:Number(data.favoriteCount||0)})}}catch{}};

  const addDetailExtras=()=>{
   const id=detailId();if(!id)return;
   const details=document.querySelector<HTMLElement>("main article");if(!details)return;
   if(!document.querySelector("[data-sahara-detail-share-row]")){
    const row=document.createElement("div");row.dataset.saharaDetailShareRow="true";row.className="sahara-detail-share-row";
    row.innerHTML=`<span class="sahara-card-share-count" data-share-count-id="${id}">0 shares · 0 favourites</span><button type="button" class="sahara-card-share-open" aria-label="Share this service" title="Share this service">↗</button>`;
    details.appendChild(row);void loadCounts(id);
   }
   if(!document.querySelector("[data-sahara-detail-seller-badge]")){
    void fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(id)}`,{cache:"no-store"}).then(async response=>{
     if(!response.ok)return;const data=await response.json();const value=tier(Math.max(0,Number(data.orderCount)||0));if(!value)return;
     const badge=document.createElement("span");badge.dataset.saharaDetailSellerBadge="true";badge.className=`sahara-detail-seller-badge ${value.cls}`;badge.textContent=value.text;
     const seller=details.querySelector<HTMLElement>(".seller,.sellerLink,[class*='seller']");
     if(seller)seller.insertAdjacentElement("afterend",badge);else details.prepend(badge);
    }).catch(()=>{});
   }
  };
  addDetailExtras();const observer=new MutationObserver(addDetailExtras);observer.observe(document.body,{childList:true,subtree:true});

  const openFor=(trigger:Element)=>{
   const article=trigger.closest<HTMLElement>("article[id^='service-'],[data-listing-id]");
   activeId=trigger.getAttribute("data-listing-id")||article?.getAttribute("data-listing-id")||article?.id.replace(/^service-/i,"")||detailId();
   activeTitle=article?.querySelector("h1,h2,h3,h4")?.textContent?.trim()||document.querySelector("main h1")?.textContent?.trim()||"Check out this service";
   const serviceLink=article?.querySelector<HTMLAnchorElement>('a[href*="/service/"]');
   activeUrl=serviceLink?.href||window.location.href;
   if(activeId){layer.classList.add("open");layer.setAttribute("aria-hidden","false");}
  };

  const record=async(id:string)=>{try{const response=await fetch("/api/listing-engagement",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId:id})});if(response.ok){const data=await response.json() as Partial<Counts>;const shareCount=Math.max(0,Number(data.shareCount)||0);update(id,{shareCount});document.dispatchEvent(new CustomEvent("sahara-share-recorded",{detail:{listingId:id,shareCount}}));}}catch{}};
  const perform=async(kind:ShareKind)=>{
   if(!activeId)return;
   const url=activeUrl||window.location.href;
   let target="";
   if(kind==="facebook")target=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
   if(kind==="linkedin")target=`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
   if(kind==="x")target=`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(activeTitle)}`;
   if(kind==="whatsapp")target=`https://wa.me/?text=${encodeURIComponent(`${activeTitle} ${url}`)}`;
   if(kind==="copy"){
     try{await navigator.clipboard.writeText(url)}catch{}
     const label=layer.querySelector<HTMLElement>("[data-share=copy] span");
     if(label){label.textContent="Copied!";setTimeout(()=>label.textContent="Copy Link",1400)}
     return;
   }
   if(target){window.open(target,"_blank","noopener,noreferrer");void record(activeId);}
  };

  const click=(event:MouseEvent)=>{
   const element=event.target instanceof Element?event.target:null;if(!element)return;
   if(element===layer){close();return;}
   if(element.closest(".sahara-share-close")){event.preventDefault();event.stopPropagation();close();return;}
   const bottomTrigger=element.closest<HTMLElement>(".saharaCardShareButton,.sahara-card-share-open");
   if(bottomTrigger&&!layer.contains(bottomTrigger)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openFor(bottomTrigger);return;}
   const legacyTrigger=element.closest<HTMLElement>(".cardShare,.shareToggle");
   if(legacyTrigger&&!layer.contains(legacyTrigger)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openFor(legacyTrigger);return;}
   const option=element.closest<HTMLButtonElement>(".sahara-share-option[data-share]");
   if(option&&layer.contains(option)){event.preventDefault();event.stopPropagation();const kind=option.dataset.share as ShareKind|undefined;if(kind)void perform(kind);}
  };
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};
  document.addEventListener("click",click,true);document.addEventListener("keydown",key);
  return()=>{observer.disconnect();document.removeEventListener("click",click,true);document.removeEventListener("keydown",key);layer.remove();style.remove();};
 },[]);
 return null;
}
