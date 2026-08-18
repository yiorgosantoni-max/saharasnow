"use client";

import {useEffect} from "react";
import "./marketplace-card-enhancer.css";

type SellerStats={orderCount:number;sellerId?:string};
type ReviewSummary={count:number;average:number};

const sellerStatsCache=new Map<string,SellerStats>();
const reviewCache=new Map<string,ReviewSummary>();
const pendingSellerLoads=new Map<string,Promise<void>>();

async function loadSellerData(listingId:string){
  if(pendingSellerLoads.has(listingId))return pendingSellerLoads.get(listingId);
  const request=(async()=>{
    try{
      const ordersResponse=await fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(listingId)}`,{cache:"no-store"});
      const data=await ordersResponse.json();
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

function badgeForOrders(orderCount:number){
  if(orderCount>=201)return {label:"🏆 Top Seller",className:"top"};
  if(orderCount>=51)return {label:"😍 Client Favourite",className:"favourite"};
  if(orderCount>=1)return {label:"🌱 New Seller",className:"new"};
  return null;
}

function enhanceCard(article:HTMLElement){
  if(article.dataset.saharaCardEnhanced==="1")return;
  const id=article.id.replace(/^service-/i,"").trim();
  if(!id)return;
  const sellerLink=article.querySelector<HTMLElement>(".sellerLink");
  const sellerName=sellerLink?.querySelector("b");
  const cardBody=article.querySelector<HTMLElement>(".cardBody");
  if(!cardBody||!sellerLink)return;

  article.dataset.saharaCardEnhanced="1";
  article.classList.add("saharaMarketplaceCard");

  const oldMeta=cardBody.querySelector<HTMLElement>(".meta");
  const priceText=oldMeta?.querySelector("span:last-child")?.textContent?.trim()||"";
  const priceMatch=priceText.match(/€\s*([\d.,]+)/);
  const price=priceMatch?`From €${priceMatch[1]}`:priceText||"From €—";
  const title=cardBody.querySelector("h3");
  const rating=document.createElement("div");
  rating.className="saharaRatingRow";
  rating.innerHTML=`<span class="saharaRatingValue">★ <b>—</b></span><span class="saharaReviewCount">(0)</span><span class="saharaPrice">${price}</span>`;
  if(oldMeta)oldMeta.replaceWith(rating);else if(title)title.insertAdjacentElement("afterend",rating);

  const badge=document.createElement("div");
  badge.className="saharaSellerBadge";
  badge.hidden=true;
  if(title)title.insertAdjacentElement("afterend",badge);
  else rating.insertAdjacentElement("afterend",badge);

  void loadSellerData(id).then(()=>{
    const stats=sellerStatsCache.get(id)||{orderCount:0};
    const reviews=stats.sellerId?reviewCache.get(stats.sellerId):undefined;
    const sellerBadge=badgeForOrders(stats.orderCount);
    const ratingValue=rating.querySelector<HTMLElement>(".saharaRatingValue b");
    const reviewCount=rating.querySelector<HTMLElement>(".saharaReviewCount");
    if(ratingValue)ratingValue.textContent=reviews&&reviews.average>0?reviews.average.toFixed(1):"—";
    if(reviewCount)reviewCount.textContent=`(${reviews?.count||0})`;
    if(sellerBadge){
      badge.hidden=false;
      badge.className=`saharaSellerBadge ${sellerBadge.className}`;
      badge.textContent=sellerBadge.label;
    }else badge.remove();
  });
}

export default function MarketplaceCardEnhancer(){
  useEffect(()=>{
    const root=document.getElementById("service-results");
    if(!root)return;
    const scan=()=>root.querySelectorAll<HTMLElement>("article").forEach(enhanceCard);
    scan();
    const observer=new MutationObserver(scan);
    observer.observe(root,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
