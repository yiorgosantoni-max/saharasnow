"use client";

import {useEffect} from "react";

type Currency="USD"|"EUR"|"GBP"|"ZAR"|"AUD";
const rates:Record<Currency,number>={USD:1,EUR:0.92,GBP:0.79,ZAR:18.2,AUD:1.52};
const symbols:Record<Currency,string>={USD:"$",EUR:"€",GBP:"£",ZAR:"R",AUD:"A$"};
const supported=new Set<Currency>(Object.keys(rates) as Currency[]);
const moneyPattern=/(A\$|US\$|€|£|R|\$)\s*([0-9]+(?:[.,][0-9]+)?)/g;
const baseValues=new WeakMap<Text,number[]>();

function cleanLegacy(value:string){
  return value
    .replace(/Buyer\s*4%\s*fees?/gi,"Buyer 5% fee")
    .replace(/4%\s*buyer\s*fees?/gi,"5% buyer fee")
    .replace(/Buyer\s*fee\s*\(\s*4%\s*\)/gi,"Buyer fee (5%)")
    .replace(/Protected checkout shows the 4% buyer fee upfront\./gi,"Protected checkout shows the 5% buyer fee upfront.");
}
function format(amount:number,currency:Currency){
  return `${symbols[currency]}${amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

export default function CurrencyNormalizer(){
  useEffect(()=>{
    const root=document.body;
    let active:Currency="USD";
    const skip=(node:Node)=>{
      const parent=node.parentElement;
      return !parent||["SCRIPT","STYLE","TEXTAREA","INPUT","OPTION"].includes(parent.tagName)||parent.closest("[data-currency-normalized='skip']")!==null;
    };
    const getSelect=()=>document.querySelector<HTMLSelectElement>('select[aria-label="Currency"]');
    const selected=()=>{
      const value=getSelect()?.value?.toUpperCase();
      return value&&supported.has(value as Currency)?value as Currency:active;
    };
    const removeLegacyToast=()=>{
      document.querySelectorAll<HTMLElement>(".toast").forEach(el=>{
        if(/^Prices converted to /i.test((el.textContent||"").trim()))el.remove();
      });
    };
    const rewrite=(currency:Currency)=>{
      active=currency;
      try{localStorage.setItem("saharasnow_currency",currency)}catch{}
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes:Text[]=[];let node:Node|null;
      while((node=walker.nextNode())){
        const value=node.nodeValue||"";
        if(!skip(node)&&(/A\$|US\$|€|£|\$|\bR\s*[0-9]|4%\s*(buyer|platform|service)?\s*fee|Buyer\s*4%/i.test(value)))nodes.push(node as Text);
      }
      for(const text of nodes){
        const current=cleanLegacy(text.nodeValue||"");
        let values=baseValues.get(text);
        if(!values){
          values=[];
          let match:RegExpExecArray|null;
          moneyPattern.lastIndex=0;
          while((match=moneyPattern.exec(current)))values.push(Number(match[2].replace(",","."))||0);
          if(values.length)baseValues.set(text,values);
        }
        if(!values?.length){
          if(current!==text.nodeValue)text.nodeValue=current;
          continue;
        }
        let index=0;
        const next=current.replace(moneyPattern,()=>format(Math.max(0,values![index++]||0)*rates[currency],currency));
        if(next!==text.nodeValue)text.nodeValue=next;
      }
      removeLegacyToast();
    };
    const restore=()=>{
      const select=getSelect();
      if(!select)return false;
      const saved=(()=>{try{return localStorage.getItem("saharasnow_currency")}catch{return null}})()?.toUpperCase();
      if(saved&&supported.has(saved as Currency)&&select.value!==saved){
        select.value=saved;
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
      rewrite(selected());
      return true;
    };
    const onChange=(event:Event)=>{
      const target=event.target;
      if(target instanceof HTMLSelectElement&&target.getAttribute("aria-label")==="Currency")rewrite(selected());
    };
    document.addEventListener("change",onChange,true);

    // Bounded passes cover normal React hydration and async content without a
    // MutationObserver repeatedly walking the entire page on every UI update.
    const timers:number[]=[];
    const run=()=>{restore()||rewrite(active);};
    [0,150,500,1200,2500].forEach(delay=>timers.push(window.setTimeout(run,delay)));

    return()=>{
      document.removeEventListener("change",onChange,true);
      timers.forEach(id=>window.clearTimeout(id));
    };
  },[]);
  return null;
}
