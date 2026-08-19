"use client";

import {useEffect,useState} from "react";

type Media={kind:"image"|"video"|"youtube";src:string;title:string};

function youtubeEmbed(src:string){
  try{
    const url=new URL(src);
    if(url.hostname.includes("youtu.be")){
      const id=url.pathname.split("/").filter(Boolean)[0]||"";
      return id?`https://www.youtube.com/embed/${id}?autoplay=1`:src;
    }
    if(url.hostname.includes("youtube.com")){
      if(url.pathname.startsWith("/embed/"))return `${url.origin}${url.pathname}${url.search||"?autoplay=1"}`;
      const id=url.searchParams.get("v")||url.pathname.split("/").filter(Boolean).pop()||"";
      return id?`https://www.youtube.com/embed/${id}?autoplay=1`:src;
    }
  }catch{}
  return src;
}

function canEnlargeServiceMedia(){
  const path=location.pathname;
  // Never intercept homepage marketplace cards. Enlargement is available only
  // on the dedicated Services pages and individual service pages.
  return path==="/services"||path.startsWith("/services/")||path.startsWith("/service/");
}

function isServiceMedia(target:Element){
  return Boolean(target.closest(".serviceMedia,.service-media,.listingMedia,.listing-media,#service-results article[id^='service-'] .visual,article[id^='service-'] .visual"));
}

export default function ServiceMediaLightbox(){
  const[media,setMedia]=useState<Media|null>(null);

  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      if(!canEnlargeServiceMedia())return;
      const target=event.target;
      if(!(target instanceof Element)||!isServiceMedia(target))return;
      if(target.closest("button,a,.favouriteButton,.saharaCardShareButton,.cardShare,.shareToggle"))return;
      const node=target.closest("img,video,iframe")||target.querySelector("img,video,iframe");
      if(!node)return;
      const title=node.getAttribute("alt")||node.getAttribute("title")||"Service media";
      if(node instanceof HTMLImageElement&&node.currentSrc){event.preventDefault();setMedia({kind:"image",src:node.currentSrc,title});return;}
      if(node instanceof HTMLVideoElement&&node.currentSrc){event.preventDefault();setMedia({kind:"video",src:node.currentSrc,title});return;}
      if(node instanceof HTMLIFrameElement&&node.src){event.preventDefault();setMedia({kind:"youtube",src:youtubeEmbed(node.src),title});}
    };
    const prepare=()=>{
      if(!canEnlargeServiceMedia())return;
      document.querySelectorAll<HTMLIFrameElement>("#service-results article[id^='service-'] .visual iframe,article[id^='service-'] .visual iframe").forEach(frame=>{frame.style.pointerEvents="none";frame.setAttribute("tabindex","-1");});
    };
    prepare();
    const observer=new MutationObserver(prepare);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("click",onClick,true);
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setMedia(null);};
    document.addEventListener("keydown",onKey);
    return()=>{observer.disconnect();document.removeEventListener("click",onClick,true);document.removeEventListener("keydown",onKey);};
  },[]);

  if(!media)return null;
  return <div className="saharaMediaLightbox" role="dialog" aria-modal="true" aria-label="Enlarged service media" onMouseDown={event=>{if(event.target===event.currentTarget)setMedia(null)}}>
    <button type="button" className="saharaMediaLightboxClose" aria-label="Close and return to service" title="Close" onClick={()=>setMedia(null)}>×</button>
    <div className="saharaMediaLightboxContent">
      {media.kind==="image"?<img src={media.src} alt={media.title}/>:media.kind==="video"?<video src={media.src} controls autoPlay playsInline/>:<iframe src={media.src} title={media.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen/>}
    </div>
  </div>;
}
