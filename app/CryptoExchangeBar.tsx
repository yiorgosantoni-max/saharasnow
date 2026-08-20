"use client";
import {useEffect} from "react";

const wallets=[
  ["Binance","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/binance.svg"],
  ["Crypto.com","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/cryptodotcom.svg"],
  ["OKX","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/okx.svg"],
  ["Bybit","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/bybit.svg"],
  ["Kraken","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/kraken.svg"],
  ["KuCoin","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/kucoin.svg"],
  ["Coinbase","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/coinbase.svg"],
  ["BingX","https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/bingx.svg"]
] as const;

export default function CryptoExchangeBar(){
  useEffect(()=>{
    if(location.pathname!=="/")return;
    let cancelled=false;
    const install=()=>{
      if(cancelled||document.getElementById("sahara-crypto-exchanges"))return;
      const section=document.querySelector<HTMLElement>(".saharaHowItWorks");
      if(!section)return;
      const panel=document.createElement("section");
      panel.id="sahara-crypto-exchanges";
      panel.setAttribute("aria-label","Crypto payment options");
      panel.innerHTML=`<div class="sce-top"><div><span class="sce-kicker">SECURE CRYPTO CHECKOUT</span><h2>Pay with <button class="sce-toggle active" data-coin="USDT">USDT</button> or <button class="sce-toggle" data-coin="USDC">USDC</button></h2><p data-copy>Choose the stablecoin that works best for you. SaharaSnow supports USDT on Tron (TRC20) and USDC on BNB Smart Chain (BEP20).</p></div><div class="sce-coins"><button class="sce-coin active" data-coin="USDT"><span class="sce-coinIcon usdt">₮</span><span><b>USDT</b><small>Tron · TRC20</small></span></button><button class="sce-coin" data-coin="USDC"><span class="sce-coinIcon usdc">$</span><span><b>USDC</b><small>BNB Chain · BEP20</small></span></button></div></div><div class="sce-network" data-network>USDT · Tron (TRC20) · Zero deposit and checkout fees</div><div class="sce-walletLabel">Works with compatible wallets &amp; exchanges</div><div class="sce-brands" data-brands></div><small class="sce-note">Wallet and exchange names are shown as examples of compatible providers.</small>`;
      section.insertAdjacentElement("afterend",panel);
      const brands=panel.querySelector<HTMLElement>("[data-brands]");
      if(brands)wallets.forEach(([name,src])=>{const item=document.createElement("div");item.className="sce-brand";const img=document.createElement("img");img.src=src;img.alt=`${name} logo`;img.loading="eager";img.referrerPolicy="no-referrer";img.className="sce-providerLogo";img.onerror=()=>{img.remove();const fallback=document.createElement("span");fallback.className="sce-logoFallback";fallback.textContent=name.slice(0,1);item.insertBefore(fallback,item.firstChild)};const label=document.createElement("span");label.textContent=name;item.append(img,label);brands.appendChild(item)});
      const update=(coin:"USDT"|"USDC")=>{panel.querySelectorAll<HTMLElement>("[data-coin]").forEach(el=>el.classList.toggle("active",el.dataset.coin===coin));const copy=panel.querySelector<HTMLElement>("[data-copy]"),network=panel.querySelector<HTMLElement>("[data-network]");if(coin==="USDC"){if(copy)copy.textContent="Pay with USDC on BNB Smart Chain (BEP20). Scan the QR code or copy the deposit address during checkout.";if(network)network.textContent="USDC · BNB Smart Chain (BEP20) · Zero deposit and checkout fees"}else{if(copy)copy.textContent="Pay with USDT on Tron (TRC20). Scan the QR code or copy the deposit address during checkout.";if(network)network.textContent="USDT · Tron (TRC20) · Zero deposit and checkout fees"}};
      panel.querySelectorAll<HTMLButtonElement>("[data-coin]").forEach(button=>button.addEventListener("click",()=>update(button.dataset.coin as "USDT"|"USDC")));
    };
    install();const timers=[120,500,1200,2200].map(ms=>window.setTimeout(install,ms));window.addEventListener("pageshow",install);return()=>{cancelled=true;timers.forEach(clearTimeout);window.removeEventListener("pageshow",install)};
  },[]);
  return null;
}
