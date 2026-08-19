"use client";

import {useEffect} from "react";
import {getClientAuth} from "@/lib/firebase-client";

type SellerStats={orderCount:number;sellerId?:string};
type ReviewSummary={count:number;average:number};
type Engagement={shareCount:number;favoriteCount:number};

const sellerStatsCache=new Map<string,SellerStats>();
const reviewCache=new Map<string,ReviewSummary>();
const engagementCache=new Map<string,Engagement>();
const pendingSellerLoads=new Map<string,Promise<void>>();

async function authToken(){
  try{
    const auth=getClientAuth();
    await auth.authStateReady();
    return auth.currentUser?auth.currentUser.getIdToken():null;
  }catch{return null;}
}

async function loadSellerData(listingId:string){
  if(pendingSellerLoads.has(listingId))return pendingSellerLoads.get(listingId);
  const request=(async()=>{
    try{
      const response=await fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(listingId)}`,{cache:"no-store"});
      const data=await response.json();
      const sellerId=String(data.sellerId||"");
      const orderCount=Math.max(0,Number(data.orderCount)||0);
      sellerStatsCache.set(listingId,{orderCount,sellerId});
      if(sellerId){
        try{
          const reviewsResponse=await fetch(`/api/reviews?sellerId=${encodeURIComponent(sellerId)}`,{cache:"no-store"});
          const reviewsData=await reviewsResponse.json();
          const summary=reviewsData.summary||{};
          reviewCache.set(sellerId,{count:Math.max(0,Number(summary.count)||0),average:Math.max(0,Number(summary.average)||0)});
        }catch{reviewCache.set(sellerId,{count:0,average:0});}
      }
    }catch{sellerStatsCache.set(listingId,{orderCount:0});}
  })().finally(()=>pendingSellerLoads.delete(listingId));
  pendingSellerLoads.set(listingId,request);
  return request;
}

async function loadEngagement(listingId:string){
  try{
    const response=await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(listingId)}`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)return {shareCount:0,favoriteCount:0};
    const value={shareCount:Math.max(0,Number(data.shareCount)||0),favoriteCount:Math.max(0,Number(data.favoriteCount)||0)};
    engagementCache.set(listingId,value);
    return value;
  }catch{return {shareCount:0,favoriteCount:0};}
}

function sellerBadge(orderCount:number){
  if(orderCount>=201)return ["🏆 Top Seller","top"] as const;
  if(orderCount>=51)return ["😍 Client Favourite","favourite"] as const;
  if(orderCount>=1)return ["🌱 New Seller","new"] as const;
  return null;
}

function formatUsd(text:string){
  const match=text.match(/[€$]?\s*([\d.,]+)/);
  if(match?.[1])return `From $${match[1]}`;
  return "From $—";
}

function paintEngagement(listingId:string,value:Engagement){
  engagementCache.set(listingId,value);
  document.querySelectorAll<HTMLElement>(`[data-sahara-engagement-id="${CSS.escape(listingId)}"]`).forEach(element=>{
    element.textContent=`${value.shareCount} shares · ${value.favoriteCount} favourites`;
  });
}

function enhanceCard(article:HTMLElement){
  if(article.dataset.saharaCardEnhanced==="1")return;
  const id=article.id.replace(/^service-/i,"").trim();
  if(!id)return;
  const sellerLink=article.querySelector<HTMLElement>(".sellerLink,.seller");
  const cardBody=article.querySelector<HTMLElement>(".cardBody");
  if(!cardBody||!sellerLink)return;
  const sellerInfo=sellerLink.querySelector<HTMLElement>("div");
  const title=cardBody.querySelector("h3");
  if(!title)return;
  article.dataset.saharaCardEnhanced="1";
  article.classList.add("saharaMarketplaceCard");

  article.querySelectorAll<HTMLElement>(".visual .cardShare,.visual .shareToggle").forEach(button=>button.style.display="none");

  const oldMeta=cardBody.querySelector<HTMLElement>(".meta");
  const priceText=oldMeta?.querySelector("span:last-child")?.textContent?.trim()||oldMeta?.textContent?.trim()||"";
  const rating=document.createElement("div");
  rating.className="saharaRatingRow";
  rating.innerHTML=`<span class="saharaRatingValue">★ <b>—</b></span><span class="saharaReviewCount">(0)</span><span class="saharaPrice">${formatUsd(priceText)}</span>`;
  if(oldMeta)oldMeta.replaceWith(rating);else title.insertAdjacentElement("afterend",rating);

  const bottom=document.createElement("div");
  bottom.className="saharaCardBottomActions";
  bottom.innerHTML=`<span class="saharaEngagementCount" data-sahara-engagement-id="${id}">0 shares · 0 favourites</span><button type="button" class="saharaCardShareButton" data-listing-id="${id}" aria-label="Share this service" title="Share this service">↗</button>`;
  rating.insertAdjacentElement("afterend",bottom);

  const badge=document.createElement("span");
  badge.className="saharaSellerBadge";
  if(sellerInfo)sellerInfo.appendChild(badge);

  void Promise.all([loadSellerData(id),loadEngagement(id)]).then(([,engagement])=>{
    paintEngagement(id,engagement);
    const stats=sellerStatsCache.get(id)||{orderCount:0};
    const reviews=stats.sellerId?reviewCache.get(stats.sellerId):undefined;
    const ratingValue=rating.querySelector<HTMLElement>(".saharaRatingValue b");
    const reviewCount=rating.querySelector<HTMLElement>(".saharaReviewCount");
    if(ratingValue)ratingValue.textContent=reviews&&reviews.average>0?reviews.average.toFixed(1):"—";
    if(reviewCount)reviewCount.textContent=`(${reviews?.count||0})`;
    const badgeData=sellerBadge(stats.orderCount);
    if(badgeData){badge.textContent=badgeData[0];badge.className=`saharaSellerBadge ${badgeData[1]}`;}else badge.remove();
  });
}

async function loadFavorites(){
  const token=await authToken();
  if(!token)return new Set<string>();
  try{
    const response=await fetch("/api/favorites",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    if(!response.ok)return new Set<string>();
    const data=await response.json();
    return new Set<string>((data.favorites||[]).map((x:{id?:string})=>String(x.id||"")));
  }catch{return new Set<string>();}
}

export default function MarketplaceCardEnhancer(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.saharaMarketplaceCards="true";
    style.textContent=`
      #service-results{align-items:start}
      #service-results article.saharaMarketplaceCard{width:264px;min-width:264px;background:#fff;border:1px solid #e3e3e3;border-radius:8px;overflow:hidden;box-shadow:none;transition:transform .18s ease,box-shadow .18s ease}
      #service-results article.saharaMarketplaceCard:hover{transform:translateY(-2px);box-shadow:0 5px 16px rgba(16,24,40,.12)}
      #service-results article.saharaMarketplaceCard .visual{height:160px!important;min-height:160px!important;border-radius:8px 8px 0 0;overflow:hidden;position:relative;background:#eef0f3!important}
      #service-results article.saharaMarketplaceCard .visual>img{width:100%!important;height:100%!important;object-fit:cover!important;display:block}
      #service-results article.saharaMarketplaceCard .visual .cardShare,#service-results article.saharaMarketplaceCard .visual .shareToggle{display:none!important}
      #service-results article.saharaMarketplaceCard .cardBody{padding:9px 10px 11px!important;background:#fff}
      #service-results article.saharaMarketplaceCard .sellerLink,#service-results article.saharaMarketplaceCard .seller{display:flex!important;align-items:center!important;gap:7px!important;min-height:32px;text-decoration:none}
      #service-results article.saharaMarketplaceCard .sellerLink>img,#service-results article.saharaMarketplaceCard .sellerLink>i,#service-results article.saharaMarketplaceCard .seller>img,#service-results article.saharaMarketplaceCard .seller>i{width:25px!important;height:25px!important;border-radius:50%!important;flex:0 0 25px}
      #service-results article.saharaMarketplaceCard .sellerLink>div,#service-results article.saharaMarketplaceCard .seller>div{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;column-gap:7px!important;width:100%!important;min-width:0}
      #service-results article.saharaMarketplaceCard .sellerLink b,#service-results article.saharaMarketplaceCard .seller b{font-size:13px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#111827!important}
      #service-results article.saharaMarketplaceCard .sellerLink small,#service-results article.saharaMarketplaceCard .seller small{grid-column:1/-1!important;font-size:10px!important;color:#6b7280!important;line-height:1.15!important}
      #service-results article.saharaMarketplaceCard h3{font-size:15px!important;line-height:1.3!important;font-weight:500!important;color:#111827!important;margin:7px 0 8px!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;min-height:39px!important}
      #service-results article.saharaMarketplaceCard .saharaRatingRow{display:flex;align-items:center;gap:4px;font-size:12px;line-height:18px;color:#111827}
      #service-results article.saharaMarketplaceCard .saharaRatingValue{font-weight:700}.saharaRatingValue b{font-weight:700}.saharaReviewCount{color:#667085}.saharaPrice{margin-left:auto;font-weight:700;color:#111827}
      #service-results article.saharaMarketplaceCard .saharaCardBottomActions{display:flex!important;align-items:center!important;gap:8px!important;margin-top:7px!important;padding-top:8px!important;border-top:1px solid #eef0f2!important;min-height:38px!important}
      #service-results article.saharaMarketplaceCard .saharaEngagementCount{font-size:11px!important;color:#667085!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      #service-results article.saharaMarketplaceCard .saharaCardShareButton{margin-left:auto!important;width:34px!important;height:34px!important;border:1px solid #d0d5dd!important;border-radius:10px!important;background:#fff!important;color:#344054!important;font-size:19px!important;display:grid!important;place-items:center!important;cursor:pointer!important;z-index:10!important;flex:0 0 34px!important}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge{justify-self:end;align-self:start;white-space:nowrap;border-radius:4px;padding:4px 6px;font-size:10px!important;font-weight:800!important;line-height:1!important;letter-spacing:0;color:#111827;background:#f3f4f6}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge.new{background:#e7f6e9;color:#166534}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge.favourite{background:#fff0d7;color:#7a4300}
      #service-results article.saharaMarketplaceCard .saharaSellerBadge.top{background:#fff0d7;color:#7a4300}
      #service-results article.saharaMarketplaceCard .favouriteButton{z-index:10!important;pointer-events:auto!important}
      @media(max-width:620px){#service-results article.saharaMarketplaceCard{width:244px;min-width:244px}#service-results article.saharaMarketplaceCard .visual{height:148px!important;min-height:148px!important}}
    `;
    document.head.appendChild(style);

    let favoriteIds=new Set<string>();
    let favoritesReady=false;
    void loadFavorites().then(ids=>{
      favoriteIds=ids;favoritesReady=true;
      document.querySelectorAll<HTMLElement>("#service-results article[id^='service-'] .favouriteButton").forEach(button=>{
        const article=button.closest<HTMLElement>("article");const id=article?.id.replace(/^service-/i,"")||"";
        if(id){button.textContent=favoriteIds.has(id)?"♥":"♡";button.setAttribute("aria-pressed",favoriteIds.has(id)?"true":"false");}
      });
    });

    const syncButton=(button:HTMLButtonElement,saved:boolean)=>{button.textContent=saved?"♥":"♡";button.setAttribute("aria-pressed",saved?"true":"false");button.classList.toggle("isSaved",saved);};
    const favoriteClick=async(event:MouseEvent)=>{
      const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>(".favouriteButton"):null;
      if(!target)return;
      const article=target.closest<HTMLElement>("article[id^='service-']");
      const id=article?.id.replace(/^service-/i,"");
      if(!article||!id)return;
      event.preventDefault();event.stopPropagation();
      if(!favoritesReady){target.disabled=true;setTimeout(()=>target.disabled=false,700);return;}
      const token=await authToken();
      if(!token){window.dispatchEvent(new CustomEvent("sahara-auth-required"));return;}
      const saved=favoriteIds.has(id);target.disabled=true;
      try{
        const response=await fetch("/api/favorites",{method:saved?"DELETE":"POST",headers:{"content-type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({listingId:id})});
        const data=await response.json();
        if(!response.ok)throw new Error("Unable to update favourite");
        if(saved)favoriteIds.delete(id);else favoriteIds.add(id);
        document.querySelectorAll<HTMLButtonElement>(`#service-results article[id="service-${CSS.escape(id)}"] .favouriteButton`).forEach(button=>syncButton(button,!saved));
        const previous=engagementCache.get(id)||{shareCount:0,favoriteCount:0};
        paintEngagement(id,{...previous,favoriteCount:Math.max(0,Number(data.favoriteCount)||0)});
      }catch{window.dispatchEvent(new CustomEvent("sahara-favourite-error"));}
      finally{target.disabled=false;}
    };
    const refreshEngagement=(event:Event)=>{
      const detail=event as CustomEvent<{listingId?:string;shareCount?:number}>;
      const id=String(detail.detail?.listingId||"");
      if(!id)return;
      const previous=engagementCache.get(id)||{shareCount:0,favoriteCount:0};
      paintEngagement(id,{...previous,shareCount:Math.max(0,Number(detail.detail?.shareCount)||0)});
    };
    document.addEventListener("click",favoriteClick,true);
    document.addEventListener("sahara-share-recorded",refreshEngagement as EventListener);

    const scan=()=>document.querySelectorAll<HTMLElement>("#service-results article[id^='service-']").forEach(enhanceCard);
    scan();
    const root=document.getElementById("service-results");
    const observer=root?new MutationObserver(scan):null;
    if(root)observer!.observe(root,{childList:true,subtree:true});
    return()=>{observer?.disconnect();document.removeEventListener("click",favoriteClick,true);document.removeEventListener("sahara-share-recorded",refreshEngagement as EventListener);style.remove();};
  },[]);
  return null;
}
