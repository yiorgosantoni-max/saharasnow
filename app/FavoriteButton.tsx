"use client";
import {useEffect,useState} from "react";
import {getClientAuth,observeAuth} from "@/lib/firebase-client";

export default function FavoriteButton({listingId,className=""}:{listingId:string;className?:string}){
 const[saved,setSaved]=useState(false);const[busy,setBusy]=useState(false);const[ready,setReady]=useState(false);
 useEffect(()=>{let cancelled=false;let unsubscribe=()=>{};const check=async()=>{const user=getClientAuth().currentUser;if(!user){if(!cancelled){setSaved(false);setReady(true)}return}try{const token=await user.getIdToken();const response=await fetch("/api/favorites",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});const data=await response.json();if(!cancelled&&response.ok)setSaved((data.favorites||[]).some((item:{id:string})=>item.id===listingId));}finally{if(!cancelled)setReady(true)}};unsubscribe=observeAuth(()=>void check());void check();return()=>{cancelled=true;unsubscribe()}},[listingId]);
 async function toggle(event:React.MouseEvent<HTMLButtonElement>){event.preventDefault();event.stopPropagation();if(busy)return;const user=getClientAuth().currentUser;if(!user){window.location.assign("/?signin=1");return}setBusy(true);try{const token=await user.getIdToken(true);const response=await fetch("/api/favorites",{method:saved?"DELETE":"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({listingId})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to update favourite");setSaved(Boolean(data.saved));}catch(error){alert(error instanceof Error?error.message:"Unable to update favourite")}finally{setBusy(false)}}
 return <button type="button" className={className} onClick={toggle} disabled={busy||!ready} aria-label={saved?"Remove from favourites":"Save to favourites"} aria-pressed={saved}>{saved?"♥":"♡"}</button>;
}
