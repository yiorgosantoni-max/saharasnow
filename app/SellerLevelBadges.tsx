"use client";

import {useEffect} from "react";

type Badge={label:string;kind:string};
const cache=new Map<string,number>();

function level(count:number):Badge{
  if(count>=201)return {label:"🏆 Top Seller",kind:"top"};
  if(count>=51)return {label:"😍 Client Favourite",kind:"favourite"};
  return {label:"🌱 New Seller",kind:"new"};
}

function listingIdFrom(el:HTMLElement){
  const direct=el.getAttribute("data-listing-id")||el.id.replace(/^service-/i,"");
  if(direct)return direct.trim();
  const a=el.querySelector<HTMLAnchorElement>("a[href*='/service/']");
  if(a){const parts=a.pathname.split("/").filter(Boolean);return decodeURIComponent(parts[parts.length-1]||"");}
  return "";
}

function putBadge(host:HTMLElement,badge:Badge,count:number){
  let el=host.querySelector<HTMLElement>(".sahara-visible-seller-level");
  if(!el){el=document.createElement("span");el.className="sahara-visible-seller-level";host.appendChild(el);}
  el.className=`sahara-visible-seller-level ${badge.kind}`;
  el.textContent=badge.label;
  el.title=`${count} completed order${count===1?"":"s"}`;
}

export default function SellerLevelBadges(){
 useEffect(()=>{
  const style=document.createElement("style");
  style.dataset.saharaSellerLevels="true";
  style.textContent=`
   .sahara-visible-seller-level{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;white-space:nowrap!important;padding:4px 7px!important;border-radius:5px!important;font-size:10px!important;font-weight:800!important;line-height:1.1!important;margin-left:7px!important;vertical-align:middle!important;position:relative!important;z-index:20!important;visibility:visible!important;opacity:1!important}
   .sahara-visible-seller-level.new{background:#e8f7ec!important;color:#166534!important}.sahara-visible-seller-level.favourite{background:#fff0d7!important;color:#7a4300!important}.sahara-visible-seller-level.top{background:#fff0d7!important;color:#7a4300!important}
   #service-results .sellerLink,.sellerLink{overflow:visible!important}
  `;
  if(!document.querySelector("style[data-sahara-seller-levels]"))document.head.appendChild(style);

  const apply=async(article:HTMLElement)=>{
   const id=listingIdFrom(article);if(!id||article.dataset.saharaSellerLevelLoading==="1")return;
   article.dataset.saharaSellerLevelLoading="1";
   let count=cache.get(id);
   if(count===undefined){try{const r=await fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(id)}`,{cache:"no-store"});const d=await r.json();count=Math.max(0,Number(d.orderCount)||0);cache.set(id,count);}catch{count=0;}}
   const badge=level(count);
   const sellerLink=article.querySelector<HTMLElement>(".sellerLink");
   const sellerName=article.querySelector<HTMLElement>(".sellerLink b,.sellerLink strong,[data-seller-name]");
   if(sellerLink)putBadge(sellerLink,badge,count);
   else if(sellerName){const host=sellerName.parentElement||sellerName;putBadge(host,badge,count);}
   else {const heading=article.querySelector<HTMLElement>("h1,h2,h3");if(heading){const host=heading.parentElement||heading;putBadge(host,badge,count);}}
  };

  const scan=()=>{
   document.querySelectorAll<HTMLElement>("article[id^='service-'],article[data-listing-id]").forEach(a=>void apply(a));
   if(location.pathname.includes("/service/")){
    const id=decodeURIComponent(location.pathname.split("/").filter(Boolean).pop()||"");
    if(id){const main=document.querySelector<HTMLElement>("main");const seller=main?.querySelector<HTMLElement>(".sellerLink,[data-seller-name]");if(main&&seller&&!main.dataset.saharaDetailLevel){main.dataset.saharaDetailLevel="1";main.setAttribute("data-listing-id",id);void apply(main);}}
   }
  };
  scan();const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer.disconnect();style.remove();};
 },[]);
 return null;
}
