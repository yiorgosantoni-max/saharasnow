"use client";

import {useEffect} from "react";

export default function ImageProtection(){
  useEffect(()=>{
    const protect=(root:ParentNode=document)=>root.querySelectorAll("img").forEach(image=>{
      image.draggable=false;
      image.setAttribute("draggable","false");
    });
    const stopImageDrag=(event:DragEvent)=>{
      if(event.target instanceof HTMLImageElement)event.preventDefault();
    };
    protect();
    const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node instanceof HTMLImageElement){node.draggable=false;node.setAttribute("draggable","false");}
      else if(node instanceof Element)protect(node);
    })));
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("dragstart",stopImageDrag,true);
    return()=>{
      observer.disconnect();
      document.removeEventListener("dragstart",stopImageDrag,true);
    };
  },[]);
  return null;
}
