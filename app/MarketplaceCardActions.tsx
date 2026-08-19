"use client";
import {useEffect} from "react";
import {getClientAuth} from "@/lib/firebase-client";

type Counts={shareCount:number;favoriteCount:number};

function sellerTier(orderCount:number){
  if(orderCount>=201)return {text:"🏆 Top Seller",cls:"top"};
  if(orderCount>=51)return {text:"😍 Client Favourite",cls:"client"};
  if(orderCount>=1)return {text:"🌱 New Seller",cls:"new"};
  return null;
}

export default function MarketplaceCardActions(){
 useEffect(()=>{
  const saved=new Set<string>();
  const counts=new Map<string,Counts>();
  const statsLoaded=new Set<string>();
  let loadedFor="";
  let scheduled=false;

  const articleFrom=(element:Element)=>element.closest<HTMLElement>("article[id^='service-']");
  const idFrom=(element:Element)=>articleFrom(element)?.id.replace(/^service-/i,"")||"";

  const style=document.createElement("style");
  style.dataset.saharaMarketplaceCardStyles="true";
  style.textContent=`
   .grid.autoScroll{gap:16px;padding:4px 16px 18px 4px}
   .grid.autoScroll article[id^='service-']{flex:0 0 264px;width:264px;border:1px solid #e3e7ee;border-radius:9px;box-shadow:0 2px 8px rgba(15,23,42,.07);background:#fff;overflow:hidden;display:flex;flex-direction:column}
   .grid.autoScroll article[id^='service-']:hover{box-shadow:0 8px 22px rgba(15,23,42,.13)!important;transform:translateY(-2px)!important}
   .grid.autoScroll article[id^='service-'] .visual{height:160px;background:#eef1f5;flex:0 0 160px;position:relative}
   .grid.autoScroll article[id^='service-'] .visual>img{width:100%;height:100%;object-fit:cover;display:block}
   .grid.autoScroll article[id^='service-'] .visual .favouriteButton{right:12px;top:10px;width:34px;height:34px;border-radius:50%;background:rgba(15,23,42,.36);color:#fff;border:1px solid rgba(255,255,255,.75);font-size:23px;line-height:1;display:grid!important;place-items:center;cursor:pointer;z-index:8}
   .grid.autoScroll article[id^='service-'] .visual .cardShare{position:absolute;right:54px;top:10px;z-index:8}
   .grid.autoScroll article[id^='service-'] .visual .shareToggle{width:34px;height:34px;border-radius:50%;background:rgba(15,23,42,.36);color:#fff;border:1px solid rgba(255,255,255,.75);font-size:19px;display:grid;place-items:center;cursor:pointer}
   .grid.autoScroll article[id^='service-'] .cardBody{padding:10px 12px 12px;min-height:150px}
   .grid.autoScroll article[id^='service-'] .seller{gap:8px;min-height:28px;text-decoration:none}
   .grid.autoScroll article[id^='service-'] .seller>i,.grid.autoScroll article[id^='service-'] .seller>img{width:25px;height:25px;flex:0 0 25px}
   .grid.autoScroll article[id^='service-'] .seller b{font-size:13px;max-width:105px;display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .grid.autoScroll article[id^='service-'] .seller small{font-size:10px;color:#667085}
   .grid.autoScroll article[id^='service-'] .cardBody h3{font-size:16px;line-height:1.35;margin:8px 0 10px;min-height:43px;font-weight:500;color:#111827}
   .grid.autoScroll article[id^='service-'] .meta,.grid.autoScroll article[id^='service-'] .saharaRatingRow{padding-top:8px;font-size:12px;display:flex;align-items:center;gap:4px}
   .grid.autoScroll article[id^='service-'] .saharaRatingValue{font-size:13px;font-weight:700;color:#171717}
   .grid.autoScroll article[id^='service-'] .saharaReviewCount{color:#111827}
   .grid.autoScroll article[id^='service-'] .saharaPrice{margin-left:auto;font-size:12px;color:#111827}
   .sahara-seller-badge{margin-left:auto;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:5px;padding:4px 7px;font-size:10px;font-weight:800;line-height:1.1}
   .sahara-seller-badge.new{background:#eaf7ee;color:#247342}.sahara-seller-badge.client{background:#fff0df;color:#9b5a14}.sahara-seller-badge.top{background:#fff1cf;color:#855b00}
   .sahara-order-count{display:none}.sahara-service-actions{display:none}.sahara-share-trigger{display:none}
   @media(max-width:620px){.grid.autoScroll article[id^='service-']{flex-basis:244px;width:244px}.grid.autoScroll article[id^='service-'] .visual{height:148px;flex-basis:148px}}
  `;
  if(!document.querySelector("style[data-sahara-marketplace-card-styles]"))document.head.appendChild(style);

  const syncFavorite=(button:HTMLButtonElement,id:string,on:boolean)=>{
    button.textContent=on?"♥":"♡";
    button.disabled=false;
    button.setAttribute("aria-pressed",String(on));
    button.classList.toggle("isSaved",on);
  };

  const paint=()=>document.querySelectorAll<HTMLButtonElement>("article[id^='service-'] .favouriteButton").forEach(button=>{
    const id=idFrom(button);
    if(id)syncFavorite(button,id,saved.has(id));
  });

  const updateCount=(id:string,next:Partial<Counts>)=>{
    const value={shareCount:0,favoriteCount:0,...counts.get(id),...next};
    counts.set(id,value);
    document.querySelectorAll<HTMLElement>(`[data-engagement-id="${CSS.escape(id)}"]`).forEach(element=>element.textContent=`${value.shareCount} shares · ${value.favoriteCount} favourites`);
  };

  const loadCounts=async(id:string)=>{
    try{
      const response=await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const data=await response.json();
      if(response.ok)updateCount(id,{shareCount:Number(data.shareCount||0),favoriteCount:Number(data.favoriteCount||0)});
    }catch{}
  };

  const decorate=async(article:HTMLElement)=>{
    const id=idFrom(article);
    if(!id||statsLoaded.has(id))return;
    statsLoaded.add(id);
    try{
      const response=await fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(id)}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)return;
      const tier=sellerTier(Math.max(0,Number(data.orderCount)||0));
      const seller=article.querySelector<HTMLElement>(".seller,.sellerLink");
      if(tier&&seller&&!seller.querySelector(".sahara-seller-badge")){
        const badge=document.createElement("span");
        badge.className=`sahara-seller-badge ${tier.cls}`;
        badge.textContent=tier.text;
        seller.appendChild(badge);
      }
    }catch{}
  };

  const ensure=()=>document.querySelectorAll<HTMLElement>("article[id^='service-']").forEach(article=>{
    const id=idFrom(article);
    if(id)void loadCounts(id);
    void decorate(article);
  });

  const loadFavorites=async(force=false)=>{
    const auth=getClientAuth();
    try{await auth.authStateReady()}catch{}
    const user=auth.currentUser;
    if(!user){saved.clear();loadedFor="";paint();return;}
    if(!force&&loadedFor===user.uid)return;
    loadedFor=user.uid;
    try{
      const token=await user.getIdToken(true);
      const response=await fetch("/api/favorites",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to load favourites");
      saved.clear();
      for(const item of data.favorites||[])if(item?.id)saved.add(String(item.id));
      paint();
    }catch{loadedFor="";}
  };

  const toggleFavorite=async(button:HTMLButtonElement)=>{
    const id=idFrom(button);
    if(!id)return;
    const auth=getClientAuth();
    try{await auth.authStateReady()}catch{}
    const user=auth.currentUser;
    if(!user){window.dispatchEvent(new CustomEvent("sahara-auth-required"));return;}
    if(button.dataset.busy)return;
    button.dataset.busy="1";
    const remove=saved.has(id);
    if(remove)saved.delete(id);else saved.add(id);
    paint();
    try{
      const token=await user.getIdToken(true);
      const response=await fetch("/api/favorites",{method:remove?"DELETE":"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId:id})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to update favourite");
      if(data.saved)saved.add(id);else saved.delete(id);
      updateCount(id,{favoriteCount:Number(data.favoriteCount||0)});
      document.dispatchEvent(new CustomEvent("saharasnow:favorites-changed"));
      paint();
    }catch{
      if(remove)saved.add(id);else saved.delete(id);
      paint();
    }finally{delete button.dataset.busy;}
  };

  const click=(event:MouseEvent)=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    const button=target.closest<HTMLButtonElement>("article[id^='service-'] .favouriteButton");
    if(button){event.preventDefault();event.stopPropagation();void toggleFavorite(button);}
  };

  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{scheduled=false;ensure();paint();},40);
  };

  document.addEventListener("click",click,true);
  ensure();
  void loadFavorites(true);
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>{document.removeEventListener("click",click,true);observer.disconnect();style.remove();};
 },[]);
 return null;
}
