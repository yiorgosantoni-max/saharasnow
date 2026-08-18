"use client";

import {useEffect} from "react";
import {getClientAuth} from "@/lib/firebase-client";

type Counts={shareCount:number;favoriteCount:number};
type ShareKind="facebook"|"linkedin"|"x"|"whatsapp"|"copy";

export default function MarketplaceCardActions(){
 useEffect(()=>{
  const saved=new Set<string>();
  const counts=new Map<string,Counts>();
  let loadedFor="";
  let scheduled=false;
  let activeId="";
  let activeTitle="";
  const idFrom=(element:Element)=>element.closest<HTMLElement>("article[id^='service-']")?.id.replace(/^service-/,"")||"";
  const articleFrom=(element:Element)=>element.closest<HTMLElement>("article[id^='service-']");
  const listingUrl=(id:string)=>`${window.location.origin}${window.location.pathname}#service-${encodeURIComponent(id)}`;

  const style=document.createElement("style");
  style.dataset.saharaShareStyles="true";
  style.textContent=`
   .sahara-service-actions{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(0,0,0,.08);font-size:12px;position:relative;z-index:3}
   .sahara-share-trigger{margin-left:auto;width:36px;height:36px;border:1px solid rgba(15,23,42,.13);border-radius:10px;background:#fff;color:#26324b;display:inline-grid;place-items:center;cursor:pointer;font-size:20px;line-height:1;box-shadow:0 1px 2px rgba(15,23,42,.05)}
   .sahara-share-trigger:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(15,23,42,.12)}
   .sahara-engagement-count{color:#667085;white-space:nowrap}
   .sahara-share-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.38);display:none;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(2px)}
   .sahara-share-backdrop.is-open{display:flex}
   .sahara-share-modal{width:min(620px,100%);background:#fff;border-radius:16px;padding:26px 32px 28px;box-shadow:0 24px 70px rgba(15,23,42,.28);position:relative;color:#344054;text-align:center}
   .sahara-share-close{position:absolute;right:18px;top:14px;width:38px;height:38px;border:0;background:transparent;color:#98a2b3;font-size:30px;line-height:1;cursor:pointer;border-radius:10px}
   .sahara-share-close:hover{background:#f2f4f7;color:#475467}
   .sahara-share-symbol{font-size:36px;line-height:1;margin:2px 0 12px;color:#667085}
   .sahara-share-modal h2{margin:0;color:#475467;font-size:27px;font-weight:750}
   .sahara-share-modal p{margin:10px 0 24px;color:#667085;font-size:16px}
   .sahara-share-options{display:flex;justify-content:center;gap:18px;flex-wrap:wrap}
   .sahara-share-option{width:82px;border:0;background:transparent;padding:0;color:#475467;cursor:pointer;font:inherit;display:flex;flex-direction:column;align-items:center;gap:9px}
   .sahara-share-option i{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:28px;color:#fff;box-shadow:0 4px 12px rgba(15,23,42,.14)}
   .sahara-share-option[data-share="facebook"] i{background:#4267a9}.sahara-share-option[data-share="linkedin"] i{background:#0a66c2;font-size:23px}.sahara-share-option[data-share="x"] i{background:#111}.sahara-share-option[data-share="whatsapp"] i{background:#169c36}.sahara-share-option[data-share="copy"] i{background:#fff;color:#344054;border:1px solid #d0d5dd}
   .sahara-share-option span{font-size:14px;white-space:nowrap}
   .sahara-share-note{margin-top:25px;padding:15px 16px;background:#eef3ff;border-radius:8px;color:#475467;text-align:left;font-size:14px;line-height:1.45}.sahara-share-note strong{color:#4267a9}
   @media(max-width:520px){.sahara-share-modal{padding:24px 18px 22px}.sahara-share-options{gap:12px}.sahara-share-option{width:64px}.sahara-share-option i{width:50px;height:50px}.sahara-share-modal h2{font-size:23px}}
  `;
  if(!document.querySelector("style[data-sahara-share-styles]"))document.head.appendChild(style);

  const backdrop=document.createElement("div");
  backdrop.className="sahara-share-backdrop";
  backdrop.setAttribute("aria-hidden","true");
  backdrop.innerHTML=`<div class="sahara-share-modal" role="dialog" aria-modal="true" aria-labelledby="sahara-share-title"><button type="button" class="sahara-share-close" aria-label="Close sharing popup">×</button><div class="sahara-share-symbol" aria-hidden="true">↗</div><h2 id="sahara-share-title">Sharing is caring</h2><p>Inspire people by sharing this service</p><div class="sahara-share-options"><button type="button" class="sahara-share-option" data-share="facebook"><i>f</i><span>Facebook</span></button><button type="button" class="sahara-share-option" data-share="linkedin"><i>in</i><span>LinkedIn</span></button><button type="button" class="sahara-share-option" data-share="x"><i>𝕏</i><span>X</span></button><button type="button" class="sahara-share-option" data-share="whatsapp"><i>◔</i><span>WhatsApp</span></button><button type="button" class="sahara-share-option" data-share="copy"><i>↗</i><span>Copy Link</span></button></div><div class="sahara-share-note"><strong>● Note:</strong> Clicking a sharing option will share this service using its direct link.</div></div>`;
  document.body.appendChild(backdrop);

  const closeModal=()=>{activeId="";activeTitle="";backdrop.classList.remove("is-open");backdrop.setAttribute("aria-hidden","true");};
  const openModal=(id:string,title:string)=>{activeId=id;activeTitle=title||"Check out this service";backdrop.classList.add("is-open");backdrop.setAttribute("aria-hidden","false");(backdrop.querySelector<HTMLButtonElement>(".sahara-share-close"))?.focus();};
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")closeModal();};
  document.addEventListener("keydown",onKeyDown);

  const paintFavorite=(button:HTMLButtonElement)=>{const id=idFrom(button);const isSaved=saved.has(id);button.textContent=isSaved?"♥":"♡";button.setAttribute("aria-pressed",String(isSaved));button.setAttribute("aria-label",isSaved?"Remove from favourites":"Save service to favourites");button.style.display="inline-flex";button.style.visibility="visible";button.style.opacity="1";};
  const paint=()=>document.querySelectorAll<HTMLButtonElement>(".visual .favouriteButton").forEach(paintFavorite);
  const updateCount=(id:string,next:Partial<Counts>)=>{const current=counts.get(id)||{shareCount:0,favoriteCount:0};counts.set(id,{...current,...next});document.querySelectorAll<HTMLElement>(`[data-engagement-id="${CSS.escape(id)}"]`).forEach(el=>{const c=counts.get(id)!;el.textContent=`${c.shareCount} shares · ${c.favoriteCount} favourites`;});};
  const loadCounts=async(id:string)=>{try{const r=await fetch(`/api/listing-engagement?listingId=${encodeURIComponent(id)}`,{cache:"no-store"});if(!r.ok)return;const d:unknown=await r.json();const data=d&&typeof d==="object"?d as {shareCount?:unknown;favoriteCount?:unknown}:{};updateCount(id,{shareCount:Number(data.shareCount||0),favoriteCount:Number(data.favoriteCount||0)});}catch{}};

  const ensureActions=()=>{
   document.querySelectorAll<HTMLElement>("article[id^='service-']").forEach(article=>{
    const id=article.id.replace(/^service-/,"");if(!id||article.querySelector("[data-sahara-service-actions]"))return;
    const actions=document.createElement("div");actions.dataset.saharaServiceActions="true";actions.setAttribute("data-currency-normalized","skip");actions.className="sahara-service-actions";
    actions.innerHTML=`<span data-engagement-id="${id}" class="sahara-engagement-count">0 shares · 0 favourites</span><button type="button" class="sahara-share-trigger" data-share-open aria-label="Share this service" title="Share">⌯</button>`;
    article.appendChild(actions);void loadCounts(id);
   });
   paint();
  };
  const schedule=()=>{if(scheduled)return;scheduled=true;window.setTimeout(()=>{scheduled=false;ensureActions();},50);};
  const load=async()=>{const user=getClientAuth().currentUser;if(!user){saved.clear();loadedFor="";paint();return;}if(loadedFor===user.uid)return;loadedFor=user.uid;try{const token=await user.getIdToken();const r=await fetch("/api/favorites",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});const d:unknown=await r.json();const data=d&&typeof d==="object"?d as {favorites?:Array<{id?:unknown}>}:{};saved.clear();for(const item of data.favorites||[])if(item?.id)saved.add(String(item.id));paint();}catch{loadedFor="";}};
  const toggle=async(button:HTMLButtonElement)=>{const id=idFrom(button);if(!id)return;const user=getClientAuth().currentUser;if(!user){window.location.assign("/?signin=1");return;}button.disabled=true;try{const token=await user.getIdToken(true);const removing=saved.has(id);const r=await fetch("/api/favorites",{method:removing?"DELETE":"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId:id})});const d:unknown=await r.json();const data=d&&typeof d==="object"?d as {error?:unknown;saved?:unknown;favoriteCount?:unknown}:{};if(!r.ok)throw new Error(typeof data.error==="string"?data.error:"Unable to update favourite");if(data.saved===false||removing)saved.delete(id);else saved.add(id);paint();updateCount(id,{favoriteCount:Math.max(0,Number(data.favoriteCount??(counts.get(id)?.favoriteCount||0)))});document.dispatchEvent(new CustomEvent("saharasnow:favorites-changed"));}catch(error){alert(error instanceof Error?error.message:"Unable to update favourite");}finally{button.disabled=false;}};
  const recordShare=async(id:string)=>{try{const r=await fetch("/api/listing-engagement",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({listingId:id})});const d:unknown=await r.json();const data=d&&typeof d==="object"?d as {shareCount?:unknown}:{};if(r.ok)updateCount(id,{shareCount:Number(data.shareCount||0)});}catch{}};
  const performShare=async(kind:ShareKind)=>{if(!activeId)return;const url=listingUrl(activeId);const text=activeTitle;let target="";if(kind==="facebook")target=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;else if(kind==="linkedin")target=`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;else if(kind==="x")target=`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;else if(kind==="whatsapp")target=`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
   if(kind==="copy"){try{await navigator.clipboard.writeText(url);}catch{const input=document.createElement("textarea");input.value=url;document.body.appendChild(input);input.select();document.execCommand("copy");input.remove();}const label=backdrop.querySelector<HTMLElement>("[data-share='copy'] span");if(label){label.textContent="Copied!";window.setTimeout(()=>{label.textContent="Copy Link";},1400);}}
   else if(target)window.open(target,"_blank","noopener,noreferrer");
   void recordShare(activeId);if(kind!=="copy")closeModal();
  };
  const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target:null;if(!target)return;
   if(target===backdrop){closeModal();return;}if(target.closest(".sahara-share-close")){closeModal();return;}
   const modalShare=target.closest<HTMLButtonElement>(".sahara-share-option[data-share]");if(modalShare&&backdrop.contains(modalShare)){const kind=modalShare.dataset.share as ShareKind|undefined;if(kind)void performShare(kind);return;}
   const favorite=target.closest<HTMLButtonElement>(".visual .favouriteButton");if(favorite){event.preventDefault();event.stopPropagation();void toggle(favorite);return;}
   const trigger=target.closest<HTMLButtonElement>("[data-sahara-service-actions] [data-share-open]");if(trigger){event.preventDefault();event.stopPropagation();const article=articleFrom(trigger);if(!article)return;const id=article.id.replace(/^service-/,"");const title=article.querySelector("h1,h2,h3,h4")?.textContent?.trim()||"Check out this service";openModal(id,title);}
  };
  document.addEventListener("click",click,true);ensureActions();void load();const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});return()=>{document.removeEventListener("click",click,true);document.removeEventListener("keydown",onKeyDown);observer.disconnect();backdrop.remove();if(style.parentNode===document.head)style.remove();};
 },[]);
 return null;
}
