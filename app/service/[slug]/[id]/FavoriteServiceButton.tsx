"use client";
import {useEffect,useState} from "react";
import {getClientAuth} from "@/lib/firebase-client";

export default function FavoriteServiceButton({listingId}:{listingId:string}){
 const[saved,setSaved]=useState(false);const[busy,setBusy]=useState(false);
 useEffect(()=>{let cancelled=false;(async()=>{const user=getClientAuth().currentUser;if(!user)return;try{const token=await user.getIdToken();const response=await fetch("/api/favorites",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json();if(!cancelled&&response.ok)setSaved((data.favorites||[]).some((item:{id:string})=>item.id===listingId));}catch{}})();return()=>{cancelled=true}},[listingId]);
 async function toggle(){if(busy)return;const user=getClientAuth().currentUser;if(!user){window.location.assign("/?signin=1");return}setBusy(true);try{const token=await user.getIdToken();const response=await fetch("/api/favorites",{method:saved?"DELETE":"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId})});if(!response.ok)throw new Error("Unable to update favourite");setSaved(!saved);}finally{setBusy(false)}}
 return <button type="button" onClick={toggle} disabled={busy} aria-label={saved?"Remove from favourites":"Save service to favourites"} aria-pressed={saved} style={{border:"1px solid #e6e8ec",background:"#fff",width:42,height:42,borderRadius:"50%",fontSize:22,cursor:busy?"wait":"pointer",lineHeight:1}}>{saved?"♥":"♡"}</button>;
}
