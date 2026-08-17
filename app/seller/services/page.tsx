"use client";
import {useEffect,useState} from "react";
import {getClientAuth} from "@/lib/firebase-client";

type Listing={id:string;title?:string;status?:string;photoUrls?:string[];packages?:Array<{priceCents:number}>;updatedAt?:unknown};
export default function SellerServicesPage(){
 const[listings,setListings]=useState<Listing[]>([]);const[busy,setBusy]=useState(true);const[error,setError]=useState("");
 const load=async()=>{try{const auth=getClientAuth();if(!auth.currentUser){setError("Please sign in first.");return}const token=await auth.currentUser.getIdToken(true);const response=await fetch("/api/listings?mine=1",{headers:{authorization:`Bearer ${token}`}});const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load your services");setListings(data.listings||[])}catch(e){setError(e instanceof Error?e.message:"Unable to load your services")}finally{setBusy(false)}};
 useEffect(()=>{load()},[]);
 return <main style={{maxWidth:1100,margin:"35px auto",padding:"0 20px 60px"}}><div style={{marginBottom:25}}><small style={{letterSpacing:2,fontWeight:700}}>SELLER DASHBOARD</small><h1 style={{margin:"6px 0"}}>My services</h1><p style={{color:"#667085"}}>Edit your pricing, packages, descriptions and pictures at any time.</p></div>{error&&<p role="alert" style={{padding:12,borderRadius:10,background:"#fff1f2"}}>{error}</p>}{busy?<p>Loading your services…</p>:!listings.length?<section style={card}><h2>No services yet</h2><p>Create your first service from the Seller dashboard.</p><a href="/?services=1" style={button}>Create a service</a></section>:<div style={{display:"grid",gap:14}}>{listings.map(item=><section key={item.id} style={card}><div style={{display:"flex",gap:18,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div style={{display:"flex",gap:15,alignItems:"center"}}>{item.photoUrls?.[0]?<img src={item.photoUrls[0]} alt="" style={{width:110,height:80,objectFit:"cover",borderRadius:12}}/>:<div style={{width:110,height:80,borderRadius:12,background:"#f2f4f7"}}/>}<div><h2 style={{margin:"0 0 6px"}}>{item.title||"Untitled service"}</h2><span style={{padding:"4px 8px",borderRadius:999,background:"#f2f4f7",fontSize:12}}>{item.status||"unknown"}</span></div></div><a href={`/seller/edit/${item.id}`} style={button}>Edit listing</a></div></section>)}</div>}</main>
}
const card={background:"#fff",border:"1px solid #e5e7eb",borderRadius:16,padding:18};
const button={display:"inline-block",padding:"10px 15px",borderRadius:10,background:"#17135f",color:"#fff",textDecoration:"none",fontWeight:700};
