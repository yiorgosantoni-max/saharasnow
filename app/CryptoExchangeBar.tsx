"use client";
import {useEffect} from "react";

const wallets=[
  ["Binance","https://cdn.simpleicons.org/binance/F3BA2F"],
  ["Crypto.com","https://cdn.simpleicons.org/crypto.com/103F68"],
  ["OKX","https://cdn.simpleicons.org/okx/111111"],
  ["Bybit","https://cdn.simpleicons.org/bybit/F7A600"],
  ["Kraken","https://cdn.simpleicons.org/kraken/5741D9"],
  ["KuCoin","https://cdn.simpleicons.org/kucoin/24B47E"],
  ["Coinbase","https://cdn.simpleicons.org/coinbase/0052FF"],
  ["BingX","https://cdn.simpleicons.org/bingx/1677FF"]
] as const;

export default function CryptoExchangeBar(){useEffect(()=>{if(location.pathname!=="/")return;let cancelled=false;const install=()=>{if(cancelled||document.getElementById("sahara-crypto-exchanges"))return;const section=document.querySelector<HTMLElement>(".saharaHowItWorks");if(!section)return;const panel=document.createElement("section");panel.id="sahara-crypto-exchanges";panel.setAttribute("aria-label","Crypto payment options");panel.innerHTML=`<div class="sce-top"><div><span class="sce-kicker">SECURE CRYPTO CHECKOUT</span><h2>Pay with <button class="sce-toggle active" data-coin="USDT">USDT</button> or <button class="sce-toggle" data-coin="USDC">USDC</button></h2><p data-copy>Choose the stablecoin that works best for you. SaharaSnow supports USDT on Tron (TRC20) and USDC on BNB Smart Chain (BEP20).</p></div><div class="sce-coins"><button class="sce-coin active" data-coin="USDT"><span class="sce-coinIcon usdt">₮</span><span><b>USDT</b><small>Tron · TRC20</small></span></button><button class="sce-coin" data-coin="USDC"><span class="sce-coinIcon usdc">$</span><span><b>USDC</b><small>BNB Chain · BEP20</small></span></button></div></div><div class="sce-network" data-network>USDT · Tron (TRC20) · Zero deposit and checkout fees</div><div class="sce-walletLabel">Works with compatible wallets &amp; exchanges</div><div class="sce-brands">${wallets.map(([name,src])=>`<div class="sce-brand"><img src="${src}" alt="${name} logo"/><span>${name}</span></div>`).join("")}</div><small class="sce-note">Wallet and exchange names are shown as examples of compatible providers.</small>`;section.insertAdjacentElement("afterend",panel);
const update=(coin:"USDT"|"USDC")=>{panel.querySelectorAll<HTMLElement>("[data-coin]").forEach(el=>el.classList.toggle("active",el.dataset.coin===coin));const copy=panel.querySelector<HTMLElement>("[data-copy]"),network=panel.querySelector<HTMLElement>("[data-network]");if(coin==="USDC"){if(copy)copy.textContent="Pay with USDC on BNB Smart Chain (BEP20). Scan the QR code or copy the deposit address during checkout.";if(network)network.textContent="USDC · BNB Smart Chain (BEP20) · Zero deposit and checkout fees"}else{if(copy)copy.textContent="Pay with USDT on Tron (TRC20). Scan the QR code or copy the deposit address during checkout.";if(network)network.textContent="USDT · Tron (TRC20) · Zero deposit and checkout fees"}};
panel.querySelectorAll<HTMLButtonElement>("[data-coin]").forEach(button=>button.addEventListener("click",()=>update(button.dataset.coin as "USDT"|"USDC")));};install();const timers=[120,500,1200,2200].map(ms=>window.setTimeout(install,ms));window.addEventListener("pageshow",install);return()=>{cancelled=true;timers.forEach(clearTimeout);window.removeEventListener("pageshow",install)}},[]);return null}
