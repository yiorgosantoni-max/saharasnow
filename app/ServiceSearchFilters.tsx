"use client";
import {useEffect} from "react";

const findPopular=()=>[...document.querySelectorAll<HTMLElement>("main *")].find(el=>/^\s*popular\s*:/i.test((el.innerText||"").trim()));
const searchRoot=(input:HTMLInputElement,main:HTMLElement)=>{let node:HTMLElement=input;while(node.parentElement&&node.parentElement!==main){const parent=node.parentElement;const hasSearch=!!parent.querySelector("input[type='search'],input[placeholder*='search' i],input[placeholder*='service' i]");const controls=parent.querySelectorAll("input,select,button").length;if(hasSearch&&controls>1)node=parent;else break;}return node;};

export default function ServiceSearchFilters(){useEffect(()=>{if(location.pathname!=="/")return;let cancelled=false;const install=()=>{if(cancelled)return;const main=document.querySelector<HTMLElement>("main");const popular=findPopular();if(!main||!popular)return;
// Remove only the previously injected search bar; keep the site's real search component intact.
document.getElementById("saharasnow-service-filters")?.remove();
const inputs=[...main.querySelectorAll<HTMLInputElement>("input[type='search'],input[placeholder*='search' i],input[placeholder*='service' i]")];
if(!inputs.length)return;
const roots:HTMLElement[]=[];
for(const input of inputs){const root=searchRoot(input,main);if(!roots.some(existing=>existing===root||existing.contains(root)||root.contains(existing)))roots.push(root);}
if(!roots.length)return;
// The first real homepage search is the one to keep and place directly above Popular.
const keep=roots[0];
keep.style.removeProperty("display");keep.style.removeProperty("visibility");keep.removeAttribute("aria-hidden");
if(keep.nextElementSibling!==popular)popular.insertAdjacentElement("beforebegin",keep);
// Hide every other search bar without touching its data or unrelated UI.
for(const duplicate of roots.slice(1)){duplicate.style.setProperty("display","none","important");duplicate.setAttribute("aria-hidden","true");}
};
install();
const timers=[100,500,1200].map(ms=>window.setTimeout(install,ms));window.addEventListener("pageshow",install);return()=>{cancelled=true;timers.forEach(clearTimeout);window.removeEventListener("pageshow",install);};},[]);return null;}
