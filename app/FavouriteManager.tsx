"use client";
import {useEffect,useRef,useState} from "react";
import {getClientAuth,observeAuth} from "@/lib/firebase-client";

type Favorite={id:string;title:string;category:string;subcategory:string;sellerName:string;photoUrls:string[];priceCents:number};
const money=(cents:number)=>`$${(Math.max(500,Number(cents)||500)/100).toFixed(2)}`;
export default function FavouriteManager(){
 const[open,setOpen]=useState(false);const[items,setItems]=useState<Favorite[]>([]);const[loading,setLoading]=useState(false);const[notice,setNotice]=useState("");const[signedIn,setSignedIn]=useState(false);const signedInRef=useRef(false);
 const token=async()=>{const user=getClientAuth().currentUser;if(!user)throw new Error("Please sign in to save services.");return user.getIdToken();};
 const load=async()=>{try{setLoading(true);const t=await token();const r=await fetch("/api/favorites",{headers:{authorization:`Bearer ${t}`},cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load favourites");setItems(Array.isArray(d.favorites)?d.favorites:[])}catch(e){setNotice(e instanceof Error?e.message:"Unable to load favourites")}finally{setLoading(false)}};
 useEffect(()=>observeAuth(ok=>{signedInRef.current=ok;setSignedIn(ok);if(ok)void load();else setItems([])}),[]);
 useEffect(()=>{
   const openFavourites=()=>{if(!signedInRef.current){setNotice("Please sign in to save services.");return}setOpen(true);void load()};
   document.addEventListener("saharasnow:open-favourites",openFavourites);
   return()=>document.removeEventListener("saharasnow:open-favourites",openFavourites);
 },[]);
 if(!open)return notice?<div className="favouriteToast" onAnimationEnd={()=>setNotice("")}>{notice}</div>:null;
 return <div className="backdrop" onMouseDown={()=>setOpen(false)}><div className="accountModal favouriteModal" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={()=>setOpen(false)}>×</button><div className="accountTop"><img src="/logo.png" alt="Saharasnow"/><div><small>BUYER</small><h2>FAVOURITES</h2></div></div><div className="accountTabs"><button className="active">Saved services</button></div>{notice&&<p className="listingNotice">{notice}</p>}{loading?<div className="noOrders"><b>Loading your saved services…</b></div>:items.length===0?<div className="noOrders"><b>No favourite services yet</b><p>Click the ♡ on any service to save it here.</p></div>:<div className="myServicesGrid">{items.map(item=><article key={item.id} onClick={()=>location.assign(`/service/${encodeURIComponent((item.subcategory||item.category||"service").toLowerCase().replace(/[^a-z0-9]+/g,"-"))}/${item.id}`)}><img src={item.photoUrls?.[0]||"/logo.png"} alt=""/><div><small>{item.category} · {item.subcategory}</small><h4>{item.title}</h4><strong>From {money(item.priceCents)}</strong><button className="deleteServiceButton" onClick={e=>{e.stopPropagation();void (async()=>{try{const t=await token();const r=await fetch("/api/favorites",{method:"DELETE",headers:{"content-type":"application/json",authorization:`Bearer ${t}`},body:JSON.stringify({listingId:item.id})});if(!r.ok)return;setItems(v=>v.filter(x=>x.id!==item.id))}catch(error){setNotice(error instanceof Error?error.message:"Unable to remove favourite")}})()}}>Remove</button></div></article>)}</div>}</div></div>;
}
