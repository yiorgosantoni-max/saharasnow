"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getClientAuth} from "@/lib/firebase-client";

type Review={id:string;rating?:number;text?:string;review?:string;buyerName?:string;buyerEmail?:string;buyerId?:string;sellerId?:string;orderId?:string;orderNumber?:string;createdAt?:unknown};
type Collection="reviews"|"buyerReviews";

export default function AdminReviews(){
  const [reviews,setReviews]=useState<Review[]>([]);
  const [buyerFeedback,setBuyerFeedback]=useState<Review[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState("");

  const load=async()=>{
    try{
      setError("");
      const auth=getClientAuth();
      await auth.authStateReady();
      const user=auth.currentUser;
      if(!user)throw new Error("Sign in with your administrator account first.");
      const token=await user.getIdToken(true);
      const r=await fetch("/api/admin/reviews",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Unable to load reviews");
      setReviews(Array.isArray(d.reviews)?d.reviews:[]);
      setBuyerFeedback(Array.isArray(d.buyerFeedback)?d.buyerFeedback:[]);
    }catch(e){setError(e instanceof Error?e.message:"Unable to load reviews")}
  };
  useEffect(()=>{void load()},[]);

  const act=async(review:Review,action:"delete"|"reset",collection:Collection)=>{
    const note=action==="reset"?window.prompt("Reason for requesting this be submitted again:"):window.prompt("Optional reason for deleting this entry:");
    if(note===null)return;
    if(action==="reset"&&!note.trim()){setError("A reason is required when requesting a change.");return}
    if(!confirm(action==="reset"?"Request a change? The current entry will be removed and the author notified and allowed to submit a new one.":"Delete this entry permanently?"))return;
    setBusy(`${review.id}:${action}`);
    try{
      const user=getClientAuth().currentUser;
      if(!user)throw new Error("Please sign in again");
      const token=await user.getIdToken(true);
      const r=await fetch("/api/admin/reviews",{method:"PATCH",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({reviewId:review.id,action,note:note.trim(),collection})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Action failed");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Action failed")}
    finally{setBusy("")}
  };

  return <main className="adminShell">
    <header className="adminHeader">
      <Link href="/" className="brand">saharasnow</Link>
      <div><b>Review moderation</b><small>Delete reviews/feedback or request a corrected submission, all tracked by order number</small></div>
      <div className="adminHeaderActions"><Link href="/admin"><button>← Admin dashboard</button></Link><button onClick={()=>void load()}>Refresh</button></div>
    </header>
    {error&&<div className="adminError">{error}</div>}
    <section className="adminHero"><div><span>TRUST & SAFETY</span><h1>Review moderation</h1><p>Remove inappropriate entries or request a corrected submission from the original author.</p></div></section>

    <section className="adminPanel">
      <div className="adminPanelHead"><div><h2>Buyer → seller reviews</h2><p>{reviews.length} review{reviews.length===1?"":"s"}</p></div></div>
      {reviews.length===0?<div className="adminEmpty">No reviews found.</div>:<div className="adminRows">
        {reviews.map(r=><article className="adminRow" key={r.id}>
          <div className="adminRowMain">
            <strong>{"★".repeat(Math.max(0,Math.min(5,Number(r.rating)||0)))} {Number(r.rating)||0}/5</strong>
            <small>Order #{r.orderNumber||r.orderId||"—"} · Seller: {r.sellerId||"—"}</small>
            <p>{String(r.text||r.review||"No written review")}</p>
          </div>
          <div className="adminRowActions">
            <button disabled={busy===`${r.id}:reset`} onClick={()=>void act(r,"reset","reviews")}>{busy===`${r.id}:reset`?"Working…":"Request review change"}</button>
            <button className="danger" disabled={busy===`${r.id}:delete`} onClick={()=>void act(r,"delete","reviews")}>{busy===`${r.id}:delete`?"Working…":"Delete review"}</button>
          </div>
        </article>)}
      </div>}
    </section>

    <section className="adminPanel">
      <div className="adminPanelHead"><div><h2>Seller → buyer feedback</h2><p>{buyerFeedback.length} entr{buyerFeedback.length===1?"y":"ies"}</p></div></div>
      {buyerFeedback.length===0?<div className="adminEmpty">No buyer feedback found.</div>:<div className="adminRows">
        {buyerFeedback.map(r=><article className="adminRow" key={r.id}>
          <div className="adminRowMain">
            <strong>{"★".repeat(Math.max(0,Math.min(5,Number(r.rating)||0)))} {Number(r.rating)||0}/5</strong>
            <small>Order #{r.orderNumber||r.orderId||"—"} · Buyer: {r.buyerId||"—"}</small>
            <p>{String(r.text||r.review||"No written feedback")}</p>
          </div>
          <div className="adminRowActions">
            <button disabled={busy===`${r.id}:reset`} onClick={()=>void act(r,"reset","buyerReviews")}>{busy===`${r.id}:reset`?"Working…":"Request feedback change"}</button>
            <button className="danger" disabled={busy===`${r.id}:delete`} onClick={()=>void act(r,"delete","buyerReviews")}>{busy===`${r.id}:delete`?"Working…":"Delete feedback"}</button>
          </div>
        </article>)}
      </div>}
    </section>
  </main>;
}
