"use client";

import {useEffect} from "react";

const steps=[
  {number:"01",icon:"🔎",title:"Find your perfect match",description:"Search by skill, budget, reviews, and delivery time — then choose with confidence."},
  {number:"02",icon:"🔒",title:"Order securely",description:"Protected checkout with a clear 5% buyer fee shown upfront — no surprises."},
  {number:"03",icon:"🤝",title:"Collaborate with confidence",description:"Message your seller after purchase, or unlock pre-sale chat with verified KYC."},
  {number:"04",icon:"🎉",title:"Love the result",description:"Approve your delivery, leave an emoji rating, and celebrate a job well done."}
];

export default function HowItWorksEnhancer(){
  useEffect(()=>{
    const apply=()=>{
      const all=Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p,span,div"));
      const heading=all.find(el=>el.textContent?.trim()==="From idea to done, without the guesswork.");
      if(!heading)return;
      const section=heading.parentElement?.parentElement||heading.parentElement;
      if(!section)return;
      section.classList.add("saharaHowItWorks");
      all.filter(el=>el.textContent?.includes("4% buyer fee")).forEach(el=>{el.textContent=el.textContent?.replace("4% buyer fee","5% buyer fee")||"";});
      steps.forEach(step=>{
        const titleEl=Array.from(section.querySelectorAll<HTMLElement>("h1,h2,h3,h4,strong,b,div")).find(el=>el.textContent?.trim()===step.title.replace(" perfect","")) || Array.from(section.querySelectorAll<HTMLElement>("h1,h2,h3,h4,strong,b,div")).find(el=>el.textContent?.trim()===step.title.split(" with")[0]) || Array.from(section.querySelectorAll<HTMLElement>("h1,h2,h3,h4,strong,b,div")).find(el=>el.textContent?.trim()===({"01":"Find your match","02":"Order securely","03":"Collaborate","04":"Love the result"} as Record<string,string>)[step.number]);
        if(!titleEl)return;
        const row=titleEl.parentElement;
        if(!row)return;
        row.classList.add("saharaHowStep");
        row.setAttribute("data-step",step.number);
        const oldNumber=Array.from(row.querySelectorAll<HTMLElement>("span,div,p")).find(el=>el.textContent?.trim()===step.number);
        if(oldNumber&&!oldNumber.dataset.saharaEmoji){oldNumber.dataset.saharaEmoji="1";oldNumber.textContent=`${step.icon} ${step.number}`;oldNumber.classList.add("saharaStepNumber");}
        if(!titleEl.dataset.saharaPimped){titleEl.dataset.saharaPimped="1";titleEl.textContent=step.title;titleEl.insertAdjacentHTML("afterbegin",`<span class="saharaStepIcon" aria-hidden="true">${step.icon}</span>`);}
        const desc=Array.from(row.querySelectorAll<HTMLElement>("p,span,div")).find(el=>el!==titleEl&&el.textContent?.trim().length&&(/Search by skill|Protected checkout|Message after purchase|Approve delivery/.test(el.textContent||"")));
        if(desc)desc.textContent=step.description;
      });
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    window.addEventListener("pageshow",apply);
    return()=>{observer.disconnect();window.removeEventListener("pageshow",apply);};
  },[]);
  return <style>{`
    .saharaHowItWorks{position:relative;overflow:hidden!important;background:linear-gradient(135deg,#f8fafc 0%,#eef2f7 48%,#f7f4f1 100%)!important;border-top:1px solid rgba(15,23,42,.06)!important;border-bottom:1px solid rgba(15,23,42,.06)!important}
    .saharaHowItWorks:before{content:"✨";position:absolute;right:7%;top:8%;font-size:52px;opacity:.12;pointer-events:none}.saharaHowItWorks:after{content:"🚀";position:absolute;left:4%;bottom:8%;font-size:46px;opacity:.1;pointer-events:none}
    .saharaHowItWorks h1,.saharaHowItWorks h2{letter-spacing:-.045em!important}.saharaHowStep{position:relative!important;border-radius:18px!important;transition:transform .2s ease,box-shadow .2s ease,background .2s ease}.saharaHowStep:hover{transform:translateX(6px);background:rgba(255,255,255,.68)!important;box-shadow:0 10px 28px rgba(15,23,42,.08)}
    .saharaStepIcon{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;margin-right:12px;border-radius:13px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.09);font-size:22px;vertical-align:middle}.saharaStepNumber{font-weight:800!important;letter-spacing:.12em!important;white-space:nowrap}.saharaHowStep h1,.saharaHowStep h2,.saharaHowStep h3,.saharaHowStep h4{display:flex!important;align-items:center!important}.saharaHowStep p{line-height:1.65!important}
    @media(max-width:700px){.saharaHowStep:hover{transform:none}.saharaStepIcon{width:36px;height:36px;margin-right:8px;font-size:19px}}
  `}</style>;
}
