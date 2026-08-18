"use client";

import {useEffect} from "react";

function normalizeText(value:string){
  let next=value;
  next=next.replace(/€\s*([0-9]+(?:[.,][0-9]+)?)/g,(_m,raw)=>{
    const amount=Math.max(5,Number(String(raw).replace(",","."))||0);
    return `$${amount.toFixed(amount%1===0?0:2)}`;
  });
  next=next.replace(/EUR\b/gi,"USD");
  next=next.replace(/€(?=\s|$)/g,"$");
  next=next.replace(/Buyer\s*4%\s*fees?/gi,"Buyer 5% fee");
  next=next.replace(/4%\s*buyer\s*fees?/gi,"5% buyer fee");
  next=next.replace(/Buyer\s*fee\s*\(\s*4%\s*\)/gi,"Buyer fee (5%)");
  next=next.replace(/4%\s*(platform|service|buyer)\s*fee/gi,"5% $1 fee");
  next=next.replace(/Protected checkout shows the 4% buyer fee upfront\./gi,"Protected checkout shows the 5% buyer fee upfront.");
  next=next.replace(/minimum\s+price\s+(?:of\s+)?€?\s*0?[.,]?5(?:0)?/gi,"minimum price of $5");
  return next;
}

export default function CurrencyNormalizer(){
  useEffect(()=>{
    const root=document.body;
    const skip=(node:Node)=>{
      const parent=node.parentElement;
      return !parent||["SCRIPT","STYLE","TEXTAREA","INPUT","OPTION"].includes(parent.tagName)||parent.closest("[data-currency-normalized='skip']")!==null;
    };
    const forceUsd=()=>{
      const select=document.querySelector<HTMLSelectElement>('select[aria-label="Currency"]');
      if(select&&select.value!=="USD"){
        select.value="USD";
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
    };
    const normalize=()=>{
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes:Text[]=[];let node:Node|null;
      while((node=walker.nextNode()))if(!skip(node)&&(/[€]|\bEUR\b|4%\s*(buyer|platform|service)?\s*fee|Buyer\s*4%/i.test(node.nodeValue||"")))nodes.push(node as Text);
      for(const text of nodes){const before=text.nodeValue||"";const after=normalizeText(before);if(after!==before)text.nodeValue=after;}
      forceUsd();
    };
    normalize();
    const observer=new MutationObserver(normalize);
    observer.observe(root,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
