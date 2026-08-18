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
  const digits=currency==="ZAR"?2:2;
  return `${symbols[currency]}${amount.toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits})}`;
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
    const rewrite=(currency:Currency)=>{
      active=currency;
      try{localStorage.setItem("saharasnow_currency",currency)}catch{}
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const nodes:Text[]=[];let node:Node|null;
      while((node=walker.nextNode()))if(!skip(node)&&(/A\$|US\$|€|£|\$|\bR\s*[0-9]|4%\s*(buyer|platform|service)?\s*fee|Buyer\s*4%/i.test(node.nodeValue||"")))nodes.push(node as Text);
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
        if(!values?.length){if(current!==text.nodeValue)text.nodeValue=current;continue;}
        let index=0;
        const next=current.replace(moneyPattern,()=>format(Math.max(0,values![index++]||0)*rates[currency],currency));
        if(next!==text.nodeValue)text.nodeValue=next;
      }
      // The old page handler creates this toast. Currency changes should be silent.
      document.querySelectorAll<HTMLElement>(".toast").forEach(el=>{if(/^Prices converted to /i.test((el.textContent||"").trim()))el.remove();});
    };
    const restore=()=>{
      const select=getSelect();
      if(!select)return false;
      const saved=(()=>{try{return localStorage.getItem("saharasnow_currency")}catch{return null}})()?.toUpperCase();
      if(saved&&supported.has(saved as Currency)&&select.value!==saved){
        const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;
        setter?.call(select,saved);
        select.dispatchEvent(new Event("change",{bubbles:true}));
      }
      rewrite(selected());
      return true;
    };
    let attempts=0;
    const timer=window.setInterval(()=>{if(restore()||++attempts>40)window.clearInterval(timer)},50);
    const onChange=(event:Event)=>{
      const target=event.target;
      if(target instanceof HTMLSelectElement&&target.getAttribute("aria-label")==="Currency")rewrite(selected());
    };
    document.addEventListener("change",onChange,true);
    const observer=new MutationObserver(()=>{
      rewrite(selected());
      document.querySelectorAll<HTMLElement>(".toast").forEach(el=>{if(/^Prices converted to /i.test((el.textContent||"").trim()))el.remove();});
    });
    observer.observe(root,{childList:true,subtree:true,characterData:true});
    rewrite(selected());
    return()=>{window.clearInterval(timer);document.removeEventListener("change",onChange,true);observer.disconnect()};
  },[]);
  return null;
}
