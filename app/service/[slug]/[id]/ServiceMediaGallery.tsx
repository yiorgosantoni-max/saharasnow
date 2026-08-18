"use client";

import {useMemo,useState} from "react";

type Props={title:string;photoUrls:string[];videoUrl?:string};
type Media={kind:"image"|"youtube"|"video";src:string};

function youtubeEmbedUrl(value:string){
 const raw=value.trim();if(!raw)return "";
 try{const url=new URL(raw);const host=url.hostname.replace(/^www\./,"").toLowerCase();let videoId="";if(host==="youtu.be")videoId=url.pathname.split("/").filter(Boolean)[0]||"";else if(host.endsWith("youtube.com")){if(url.pathname==="/watch")videoId=url.searchParams.get("v")||"";else{const parts=url.pathname.split("/").filter(Boolean),marker=parts.findIndex(part=>["embed","shorts","live"].includes(part));if(marker>=0)videoId=parts[marker+1]||""}}return videoId?`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`:""}catch{return ""}
}

export default function ServiceMediaGallery({title,photoUrls,videoUrl=""}:Props){
 const media=useMemo<Media[]>(()=>{const items:Media[]=photoUrls.filter(Boolean).map(src=>({kind:"image",src}));const youtube=youtubeEmbedUrl(videoUrl);if(youtube)items.push({kind:"youtube",src:youtube});else if(videoUrl.trim())items.push({kind:"video",src:videoUrl.trim()});return items},[photoUrls,videoUrl]);
 const[index,setIndex]=useState(0);if(!media.length)return <div className="serviceMediaEmpty"/>;const current=media[Math.min(index,media.length-1)],move=(direction:number)=>setIndex(value=>(value+direction+media.length)%media.length);
 return <div className="serviceMediaGallery"><div className="serviceMediaStage">{current.kind==="image"?<img src={current.src} alt={`${title} image ${index+1}`} className="serviceMediaImage"/>:current.kind==="youtube"?<iframe src={current.src} title={`${title} video`} className="serviceMediaVideo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/>:<video controls preload="metadata" className="serviceMediaVideo" src={current.src}>Your browser does not support this video.</video>}{media.length>1&&<><button type="button" className="serviceMediaArrow serviceMediaPrev" onClick={()=>move(-1)} aria-label="Previous media">←</button><button type="button" className="serviceMediaArrow serviceMediaNext" onClick={()=>move(1)} aria-label="Next media">→</button></>}</div>{media.length>1&&<div className="serviceMediaDots" aria-label="Service media">{media.map((item,itemIndex)=><button type="button" key={`${item.kind}-${item.src}`} className={itemIndex===index?"active":""} onClick={()=>setIndex(itemIndex)} aria-label={`Show media ${itemIndex+1}`}>{item.kind==="image"?`Image ${itemIndex+1}`:"Video"}</button>)}</div>}</div>
}