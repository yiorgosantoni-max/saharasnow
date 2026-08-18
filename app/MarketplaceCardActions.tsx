"use client";
import {useEffect} from "react";
import {getClientAuth} from "@/lib/firebase-client";

type Counts={shareCount:number;favoriteCount:number};

export default function MarketplaceCardActions(){
 useEffect(()=>{
  const saved=new Set<string>();
  const counts=new Map<string,Counts>();
  let loadedFor="";let scheduled=false;
  const idFrom=(element:Element)=>element.closest<HTMLElement>("article[id^='service-']")?.id.replace(/^service-/,"")||"";
  const articleFrom=(element:Element)=>element.closest<HTMLElement>("article[id^='service-']");
  const listingUrl=(id:string)=>`${window.location.origin}${window.location.pathname}#service-${encodeURIComponent(id)}`;
  const paintFavorite=(button:HTMLButtonElement)=>{const id=idFrom(button);const isSaved=saved.has(id);button.textContent=isSaved?"♥":"♡";button.setAttribute("aria-pressed",String(isSaved));button.setAttribute("aria-label",isSaved?"Remove from favourites":"Save service to favourites");button.style.display="inline-flex";button.style.visibility="visible";button.style.opacity="1";};
  const paint=()=>document.querySelectorAll<HTMLButtonElement>(".visual .favouriteButton").forEach(paintFavorite);
  const updateCount=(id:string,next:Partial<Counts>)=>{const current=counts.get(id)||{shareCount:0,favoriteCount:0};counts.set(id,{...current,...next});document.querySelectorAll<HTMLElement>(`[data-engagement-id="${CSS.escape(id)}"]`).forEach(el=>{const c=counts.get(id)!;el.textContent=`${c.shareCount} shares · ${c.favoriteCount} favourites`;});};
  const loadCounts=async(id:string)=>{try{const r=await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(id)}`,{cache:"no-store"});if(!r.ok)return;const d=await r.json();updateCount(id,{shareCount:Number(d.shareCount||0),favoriteCount:Number(d.favoriteCount||0)});}catch{}};
  const ensureToolbars=()=>{
   document.querySelectorAll<HTMLElement>("article[id^='service-']").forEach(article=>{
    const id=article.id.replace(/^service-/,"");if(!id||article.querySelector("[data-share-toolbar]"))return;
    const toolbar=document.createElement("div");toolbar.dataset.shareToolbar="true";toolbar.setAttribute("data-currency-normalized","skip");toolbar.style.cssText="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08);font-size:12px;position:relative;z-index:3";
    toolbar.innerHTML=`<button type="button" data-share="facebook" aria-label="Share on Facebook">Facebook</button><button type="button" data-share="linkedin" aria-label="Share on LinkedIn">LinkedIn</button><button type="button" data-share="x" aria-label="Share on X">X</button><button type="button" data-share="whatsapp" aria-label="Share on WhatsApp">WhatsApp</button><button type="button" data-share="copy" aria-label="Copy service link">Copy link</button><span data-engagement-id="${id}" style="margin-left:auto;white-space:nowrap">0 shares · 0 favourites</span>`;
    toolbar.querySelectorAll<HTMLButtonElement>("button").forEach(button=>{button.style.cssText="border:1px solid rgba(0,0,0,.14);background:#fff;border-radius:999px;padding:5px 8px;cursor:pointer;font:inherit;color:inherit";});
    article.appendChild(toolbar);void loadCounts(id);
   });
   paint();
  };
  const schedule=()=>{if(scheduled)return;scheduled=true;window.setTimeout(()=>{scheduled=false;ensureToolbars();},50);};
  const load=async()=>{
   const user=getClientAuth().currentUser;if(!user){saved.clear();loadedFor="";paint();return;}
   if(loadedFor===user.uid)return;loadedFor=user.uid;
   try{const token=await user.getIdToken();const r=await fetch("/api/favorites",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});const d=await r.json();saved.clear();for(const item of d.favorites||[])if(item?.id)saved.add(String(item.id));paint();}catch{loadedFor="";}
  };
  const toggle=async(button:HTMLButtonElement)=>{
   const id=idFrom(button);if(!id)return;const user=getClientAuth().currentUser;if(!user){window.location.assign("/?signin=1");return;}
   button.disabled=true;try{const token=await user.getIdToken(true);const removing=saved.has(id);const r=await fetch("/api/favorites",{method:removing?"DELETE":"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to update favourite");if(d.saved===false||removing)saved.delete(id);else saved.add(id);paint();updateCount(id,{favoriteCount:Math.max(0,Number(d.favoriteCount??(counts.get(id)?.favoriteCount||0)))});document.dispatchEvent(new CustomEvent("saharasnow:favorites-changed"));}catch(error){alert(error instanceof Error?error.message:"Unable to update favourite");}finally{button.disabled=false;}
  };
  const recordShare=async(id:string)=>{try{const r=await fetch("/api/listing-engagement",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId:id})});const d=await r.json();if(r.ok)updateCount(id,{shareCount:Number(d.shareCount||0)});}catch{}};
  const share=async(button:HTMLButtonElement)=>{
   const article=articleFrom(button);if(!article)return;const id=article.id.replace(/^service-/,"");const url=listingUrl(id);const text=article.querySelector("h1,h2,h3,h4")?.textContent?.trim()||"Check out this service";const kind=button.dataset.share||"";let target="";
   if(kind==="facebook")target=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
   else if(kind==="linkedin")target=`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
   else if(kind==="x")target=`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
   else if(kind==="whatsapp")target=`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
   if(kind==="copy"){try{await navigator.clipboard.writeText(url);button.textContent="Copied!";window.setTimeout(()=>{button.textContent="Copy link";},1400);}catch{const input=document.createElement("textarea");input.value=url;document.body.appendChild(input);input.select();document.execCommand("copy");input.remove();button.textContent="Copied!";window.setTimeout(()=>{button.textContent="Copy link";},1400);}}
   else if(target)window.open(target,"_blank","noopener,noreferrer");
   if(kind)void recordShare(id);
  };
  const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target:null;if(!target)return;const favorite=target.closest<HTMLButtonElement>(".visual .favouriteButton");if(favorite){event.preventDefault();event.stopPropagation();void toggle(favorite);return;}const shareButton=target.closest<HTMLButtonElement>("[data-share-toolbar] button[data-share]");if(shareButton){event.preventDefault();event.stopPropagation();void share(shareButton);}};
  document.addEventListener("click",click,true);ensureToolbars();void load();const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});return()=>{document.removeEventListener("click",click,true);observer.disconnect();};
 },[]);
 return null;
}
