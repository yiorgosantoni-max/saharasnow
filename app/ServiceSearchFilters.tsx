"use client";
import {useEffect} from "react";

export default function ServiceSearchFilters(){useEffect(()=>{
 if(!location.pathname.startsWith("/services"))return;
 let observer:MutationObserver|undefined,scheduled=false;
 const install=()=>{
  scheduled=false;
  if(document.querySelector("#saharasnow-service-filters"))return;
  const cards=[...document.querySelectorAll<HTMLElement>("a[href*='/service/'],article[id^='service-']")].filter((e:any)=>e.querySelector("img"));
  if(!cards.length)return;
  const host=cards[0].parentElement?.parentElement||cards[0].parentElement;if(!host)return;
  const bar=document.createElement("section");bar.id="saharasnow-service-filters";
  bar.innerHTML=`<div class="ssf-head"><strong>🔎 Filter services</strong><span>Find the right match faster</span></div><input id="ssf-q" placeholder="Search services or sellers"><select id="ssf-price"><option value="">Any price</option><option value="0-25">Under $25</option><option value="25-50">$25–$50</option><option value="50-100">$50–$100</option><option value="100-250">$100–$250</option><option value="250-999999">$250+</option></select><select id="ssf-country"><option value="">🌍 Any country</option><option>Cyprus</option><option>United States</option><option>United Kingdom</option><option>Canada</option><option>Australia</option><option>Germany</option><option>France</option><option>India</option></select><select id="ssf-category"><option value="">✨ Any category</option><option>Graphics & Design</option><option>Programming & Tech</option><option>Digital Marketing</option><option>Video & Animation</option><option>Writing & Translation</option><option>Music & Audio</option><option>Business</option></select><select id="ssf-delivery"><option value="">⚡ Any delivery time</option><option value="1">Within 24 hours</option><option value="3">Up to 3 days</option><option value="7">Up to 7 days</option><option value="30">Any longer delivery</option></select><select id="ssf-rating"><option value="">⭐ Any rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option><option value="5">5.0</option></select><button id="ssf-clear" type="button">Clear all</button>`;
  host.parentElement?.insertBefore(bar,host);
  const value=(id:string)=>(bar.querySelector(id) as HTMLInputElement|HTMLSelectElement).value;
  const apply=()=>cards.forEach(card=>{const text=(card.innerText||"").toLowerCase();const q=value("#ssf-q").toLowerCase(),country=value("#ssf-country").toLowerCase(),category=value("#ssf-category").toLowerCase();const [min,max]=(value("#ssf-price")||"0-999999").split("-").map(Number);const priceMatch=text.match(/(?:from\s*)?\$\s*([0-9,.]+)/i),price=priceMatch?Number(priceMatch[1].replace(/,/g,"")):0;const ratingMatch=text.match(/(?:★|⭐)\s*([0-9.]+)/),rating=ratingMatch?Number(ratingMatch[1]):0;const daysMatch=text.match(/([0-9]+)\s*(?:day|days)/),days=daysMatch?Number(daysMatch[1]):0;const delivery=Number(value("#ssf-delivery")||0);const ok=(!q||text.includes(q))&&(!country||text.includes(country))&&(!category||text.includes(category))&&price>=min&&price<=max&&(!Number(value("#ssf-rating"))||rating>=Number(value("#ssf-rating")))&&(!delivery||(delivery===30?days>7:days>0&&days<=delivery));card.style.display=ok?"":"none"});
  bar.querySelectorAll("input,select").forEach(el=>el.addEventListener("input",apply));bar.querySelectorAll("select").forEach(el=>el.addEventListener("change",apply));bar.querySelector("#ssf-clear")?.addEventListener("click",()=>{bar.querySelectorAll<HTMLInputElement|HTMLSelectElement>("input,select").forEach(x=>x.value="");apply()});
  observer?.disconnect();
 };
 const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(install)};
 schedule();observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
 return()=>observer?.disconnect();
},[]);return null}
