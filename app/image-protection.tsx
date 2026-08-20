"use client";

import {useEffect,useRef,useState} from "react";

export default function ImageProtection(){
  const[noticeVisible,setNoticeVisible]=useState(false);
  const noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    const protect=(root:ParentNode=document)=>root.querySelectorAll("img").forEach(image=>{
      image.draggable=false;
      image.setAttribute("draggable","false");
    });
    const stopImageDrag=(event:DragEvent)=>{
      if(event.target instanceof HTMLImageElement)event.preventDefault();
    };
    const stopContextMenu=(event:MouseEvent)=>{event.preventDefault();setNoticeVisible(true);if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNoticeVisible(false),2000);};
    protect();
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node instanceof HTMLImageElement){node.draggable=false;node.setAttribute("draggable","false");}
      else if(node instanceof Element)protect(node);
    })));
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("dragstart",stopImageDrag,true);
    document.addEventListener("contextmenu",stopContextMenu,true);
    return()=>{observer.disconnect();document.removeEventListener("dragstart",stopImageDrag,true);document.removeEventListener("contextmenu",stopContextMenu,true);if(noticeTimer.current)clearTimeout(noticeTimer.current);};
  },[]);
  return noticeVisible?<div className="rightClickNotice" role="status" aria-live="polite">Right Clicking Is Prohibited!</div>:null;
}
