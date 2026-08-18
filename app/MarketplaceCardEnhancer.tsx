"use client";

import {useEffect} from "react";

type SellerStats={orderCount:number};
type ReviewSummary={count:number;average:number};

const sellerStatsCache=new Map<string,SellerStats>();
const reviewCache=new Map<string,ReviewSummary>();
const pendingSellerLoads=new Map<string,Promise<void>>();

async function loadSellerData(listingId:string,sellerId:string){
  const key=sellerId||listingId;
  if(pendingSellerLoads.has(key))return pendingSellerLoads.get(key);
  const request=(async()=>{
    const [ordersResponse,reviewsResponse]=await Promise.all([
      fetch(`/api/listing-seller-stats?listingId=${encodeURIComponent(listingId)}`,{cache:"no-store"}),
      sellerId?fetch(`/api/reviews?sellerId=${encodeURIComponent(sellerId)}`,{cache:"no-store"}):Promise.resolve(null)
    ]);
    try{
      const data=await ordersResponse.json();
      sellerStatsCache.set(key,{orderCount:Math.max(0,Number(data.orderCount)||0)});
    }catch{sellerStatsCache.set(key,{orderCount:0});}
    if(reviewsResponse){
      try{
        const data=await reviewsResponse.json();
        const summary=data.summary||{};
        reviewCache.set(key,{count:Math.max(0,Number(summary.count)||0),average:Math.max(0,Number(summary.average)||0)});
      }catch{reviewCache.set(key,{count:0,average:0});}
    }else reviewCache.set(key,{count:0,average:0});
  })().finally(()=>pendingSellerLoads.delete(key));
  pendingSellerLoads.set(key,request);
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
  const sellerId=article.getAttribute("data-seller-id")||sellerLink?.getAttribute("data-seller-id")||"";
  const sellerName=sellerLink?.querySelector("b");
  const cardBody=article.querySelector<HTMLElement>(".cardBody");
  if(!cardBody||!sellerLink)return;

  article.dataset.saharaCardEnhanced="1";
  article.classList.add("saharaMarketplaceCard");

  const sellerMeta=sellerLink.querySelector("small");
  if(sellerName){
    const level=document.createElement("span");
    level.className="saharaSellerLevel";
    level.textContent="Seller";
    sellerName.appendChild(level);
  }

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
  badge.setAttribute("aria-hidden","true");
  const actions=article.querySelector<HTMLElement>(".visual");
  if(actions)actions.insertAdjacentElement("afterend",badge);

  void loadSellerData(id,sellerId).then(()=>{
    const key=sellerId||id;
    const orders=sellerStatsCache.get(key)?.orderCount||0;
    const reviews=reviewCache.get(key)||{count:0,average:0};
    const sellerBadge=badgeForOrders(orders);
    const ratingValue=rating.querySelector<HTMLElement>(".saharaRatingValue b");
    const reviewCount=rating.querySelector<HTMLElement>(".saharaReviewCount");
    if(ratingValue)ratingValue.textContent=reviews.average>0?reviews.average.toFixed(1):"—";
    if(reviewCount)reviewCount.textContent=`(${reviews.count})`;
    if(sellerBadge){
      badge.hidden=false;
      badge.setAttribute("aria-hidden","false");
      badge.className=`saharaSellerBadge ${sellerBadge.className}`;
      badge.textContent=sellerBadge.label;
    }else badge.remove();
    if(sellerMeta)sellerMeta.textContent=`Verified creator · ${orders} ${orders===1?"order":"orders"}`;
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
    const interval=window.setInterval(scan,1000);
    return()=>{observer.disconnect();window.clearInterval(interval)};
  },[]);
  return null;
}
