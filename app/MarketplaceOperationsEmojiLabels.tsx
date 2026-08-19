"use client";
import {useEffect} from "react";
const icons=["🛒","📝","🛡️","⚖️","🌙","😍","❤️","📜","🔒","⚙️"];
export default function MarketplaceOperationsEmojiLabels(){useEffect(()=>{const apply=()=>{document.querySelectorAll<HTMLElement>(".protection .toolGrid>button").forEach((button,index)=>{const marker=button.querySelector<HTMLElement>("span");if(!marker)return;marker.textContent=icons[index]||"✨";marker.style.cssText="font-size:22px!important;line-height:1!important;letter-spacing:0!important;font-weight:400!important"})};apply();window.addEventListener("pageshow",apply);window.addEventListener("popstate",apply);return()=>{window.removeEventListener("pageshow",apply);window.removeEventListener("popstate",apply)}},[]);return null}
