"use client";
import {useEffect,useState,type CSSProperties} from "react";
import Link from "next/link";
import {getClientAuth} from "@/lib/firebase-client";

type P={id:string;userEmail?:string;userId?:string;transactionHash?:string;txHash?:string;currency?:string;amount?:number;network?:string;purpose?:string;orderId?:string|null;status?:string;submittedAt?:any;releasedEarly?:boolean};
type LP={id:string;sellerId?:string;listingId?:string;currency?:string;amount?:number;txHash?:string;status?:string;submittedAt?:any;creditsAdded?:number};
const money=(x:P)=>`${Number(x.amount||0).toFixed(2)} ${x.currency||"USDT"}`;
const when=(x:any)=>x?.seconds?new Date(x.seconds*1000).toLocaleString():"—";
const dangerStyle:CSSProperties={background:"#b00020",color:"#fff",border:"1px solid #7d0016",fontWeight:700};

export default function AdminCrypto(){
  const[payments,setPayments]=useState<P[]>([]);
  const[listingPayments,setListingPayments]=useState<LP[]>([]);
  const[e,setE]=useState("");
  const[busy,setBusy]=useState("");
  const[auto,setAuto]=useState(10);
  const[lastRun,setLastRun]=useState<Date|null>(null);
  const[lastAutoVerify,setLastAutoVerify]=useState<Date|null>(null);

  const token=async()=>{const u=getClientAuth().currentUser;if(!u)throw Error("Sign in as administrator.");return u.getIdToken(true)};

  const load=async()=>{
    try{
      const authToken=await token();
      const[r,rl]=await Promise.all([
        fetch("/api/crypto-payments?status=admin",{headers:{authorization:`Bearer ${authToken}`},cache:"no-store"}),
        fetch("/api/crypto/listing-credits?status=admin",{headers:{authorization:`Bearer ${authToken}`},cache:"no-store"}),
      ]);
      const j=await r.json(),jl=await rl.json();
      if(!r.ok)throw Error(j.error||"Unable to load crypto payments.");
      setPayments(j.payments||[]);
      if(rl.ok)setListingPayments(jl.payments||[]);
    }catch(x){setE(x instanceof Error?x.message:"Unable to load crypto payments.")}
  };

  const act=async(id:string,action:"approve"|"reject"|"forceApprove")=>{
    try{
      setBusy(id);
      const r=await fetch("/api/crypto-payments",{method:"PATCH",headers:{"content-type":"application/json",authorization:`Bearer ${await token()}`},body:JSON.stringify({id,action})});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||"Action failed.");
      await load();
    }catch(x){setE(x instanceof Error?x.message:"Action failed")}finally{setBusy("")}
  };

  const actListing=async(id:string,action:"approve"|"reject"|"forceApprove")=>{
    try{
      setBusy(`listing-${id}`);
      const r=await fetch("/api/crypto/listing-credits",{method:"PATCH",headers:{"content-type":"application/json",authorization:`Bearer ${await token()}`},body:JSON.stringify({paymentId:id,action})});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||"Action failed.");
      await load();
    }catch(x){setE(x instanceof Error?x.message:"Action failed")}finally{setBusy("")}
  };

  const autoVerify=async()=>{
    try{
      const authToken=await token();
      await Promise.all([
        fetch("/api/crypto-payments",{method:"PATCH",headers:{"content-type":"application/json",authorization:`Bearer ${authToken}`},body:JSON.stringify({action:"autoVerifyAll"})}),
        fetch("/api/crypto/listing-credits",{method:"PATCH",headers:{"content-type":"application/json",authorization:`Bearer ${authToken}`},body:JSON.stringify({action:"autoVerifyAll"})}),
      ]);
      setLastAutoVerify(new Date());
      await load();
    }catch(x){setE(x instanceof Error?x.message:"Automatic BingX verification failed.")}
  };

  const runClearance=async()=>{
    try{
      const r=await fetch("/api/admin/clearance/run",{method:"POST",headers:{authorization:`Bearer ${await token()}`}});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||"Clearance check failed.");
      setLastRun(new Date());
      if(j.released||j.advanced)await load();
    }catch(x){setE(x instanceof Error?x.message:"Clearance check failed.")}
  };

  const releaseEarly=async(orderId:string)=>{
    try{
      setBusy(`release-${orderId}`);
      const r=await fetch("/api/admin/release-early",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${await token()}`},body:JSON.stringify({orderId})});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||"Unable to release earnings early.");
      await load();
    }catch(x){setE(x instanceof Error?x.message:"Unable to release earnings early.")}finally{setBusy("")}
  };

  const remove=async(id:string)=>{
    if(!confirm("Delete this crypto transaction from history? This cannot be undone."))return;
    try{
      setBusy(`delete-${id}`);
      const r=await fetch(`/api/crypto-payments?id=${encodeURIComponent(id)}`,{method:"DELETE",headers:{authorization:`Bearer ${await token()}`}});
      const j=await r.json();
      if(!r.ok)throw Error(j.error||"Unable to delete transaction.");
      setPayments(v=>v.filter(x=>x.id!==id));
    }catch(x){setE(x instanceof Error?x.message:"Unable to delete transaction.")}finally{setBusy("")}
  };

  useEffect(()=>{
    const a=getClientAuth();
    return a.onAuthStateChanged(u=>{if(u){void load();void runClearance();void autoVerify()}});
  },[]);
  useEffect(()=>{const id=window.setInterval(()=>void runClearance(),Math.max(5,auto)*1000);return()=>window.clearInterval(id)},[auto]);
  useEffect(()=>{const id=window.setInterval(()=>void autoVerify(),120000);return()=>window.clearInterval(id)},[]);

  const orders=payments.filter(x=>x.purpose==="order"||x.orderId);
  const pending=orders.filter(x=>x.status==="pending");
  const clearance=orders.filter(x=>x.status==="approved"&&!x.releasedEarly);
  const history=payments.filter(x=>x.status!=="pending"&&!(x.status==="approved"&&!x.releasedEarly&&(x.purpose==="order"||x.orderId)));
  const pendingListing=listingPayments.filter(x=>x.status==="payment-submitted");
  const listingHistory=listingPayments.filter(x=>x.status!=="payment-submitted");

  const card=(x:P)=>{
    const isPending=x.status==="pending",approved=x.status==="approved",released=approved&&!!x.releasedEarly,releaseable=approved&&!released&&!!x.orderId;
    return <section key={x.id} style={{border:"1px solid #ddd",borderRadius:14,padding:18,margin:"14px 0"}}>
      <b>🛒 Service payment · {money(x)}</b>
      <p>User: {x.userEmail||x.userId||"—"}</p>
      {x.orderId&&<p>Order ID: {x.orderId}</p>}
      <p>Transaction hash</p>
      <code style={{display:"block",padding:10,background:"#f4f4f4",color:"#000",overflowWrap:"anywhere"}}>{x.transactionHash||x.txHash||"—"}</code>
      <p>Submitted: {when(x.submittedAt)}</p>
      {approved&&<p><b>✓ Approved{released?" · ✓ Earnings released early":""}</b></p>}
      {x.status==="rejected"&&<p><b>✕ Rejected</b></p>}
      {releaseable&&<p style={{fontWeight:700}}>⏳ Approved — seller earnings are in the five-day clearance period.</p>}
      <button disabled={!isPending||!!busy} onClick={()=>void act(x.id,"approve")} style={{marginRight:8,opacity:isPending?1:.5}}>✓ Verify on BingX &amp; approve</button>
      <button disabled={!isPending||!!busy} onClick={()=>void act(x.id,"reject")} style={{marginRight:8,opacity:isPending?1:.5}}>✕ Reject</button>
      {isPending&&<button disabled={!!busy} onClick={()=>{if(confirm("DANGER APPROVE bypasses BingX verification entirely and credits this payment immediately. Only use this if you have independently confirmed the funds arrived. Continue?"))void act(x.id,"forceApprove")}} style={{...dangerStyle,marginRight:8}}>🚨 DANGER APPROVE (skip BingX)</button>}
      {x.orderId&&<button disabled={!releaseable||!!busy} onClick={()=>void releaseEarly(String(x.orderId))} style={{marginRight:8,opacity:releaseable?1:.5}}>{released?"✓ Earnings released":"⚡ Release earnings early"}</button>}
      <button disabled={!!busy} onClick={()=>void remove(x.id)}>🗑 Delete transaction</button>
    </section>;
  };

  const listingCard=(x:LP,pendingRow:boolean)=><section key={x.id} style={{border:"1px solid #ddd",borderRadius:14,padding:18,margin:"14px 0"}}>
    <b>🎫 Listing credit pack · {Number(x.amount||0).toFixed(2)} {x.currency||"USDT"}</b>
    <p>Seller: {x.sellerId||"—"}</p>
    {x.listingId&&<p>Listing ID: {x.listingId}</p>}
    <p>Transaction hash</p>
    <code style={{display:"block",padding:10,background:"#f4f4f4",color:"#000",overflowWrap:"anywhere"}}>{x.txHash||"—"}</code>
    <p>Submitted: {when(x.submittedAt)}</p>
    {x.status==="approved"&&<p><b>✓ Verified &amp; approved{typeof x.creditsAdded==="number"?` · ${x.creditsAdded} credit(s) added`:""}</b></p>}
    {x.status==="rejected"&&<p><b>✕ Rejected</b></p>}
    {pendingRow&&<>
      <button disabled={!!busy} onClick={()=>void actListing(x.id,"approve")} style={{marginRight:8}}>✓ Verify on BingX &amp; approve</button>
      <button disabled={!!busy} onClick={()=>void actListing(x.id,"reject")} style={{marginRight:8}}>✕ Reject</button>
      <button disabled={!!busy} onClick={()=>{if(confirm("DANGER APPROVE bypasses BingX verification entirely and grants listing credits immediately. Only use this if you have independently confirmed the funds arrived. Continue?"))void actListing(x.id,"forceApprove")}} style={dangerStyle}>🚨 DANGER APPROVE (skip BingX)</button>
    </>}
  </section>;

  return <main style={{maxWidth:1100,margin:"0 auto",padding:32}}>
    <Link href="/admin">← Admin dashboard</Link>
    <h1>💰 CRYPTO</h1>
    <p>Transactions stay in history until explicitly deleted.</p>
    <section style={{padding:16,border:"1px solid #ddd",borderRadius:14,marginBottom:24}}>
      <b>🔁 Automatic BingX verification</b>
      <p>Every 2 minutes, all pending payments (service orders and listing credits) are checked against your connected BingX USDT/USDC deposit history. A payment is auto-approved only when the transaction hash, amount and currency all match exactly.</p>
      <button onClick={()=>void autoVerify()}>Run BingX check now</button>
      {lastAutoVerify&&<small style={{marginLeft:10}}>Last check: {lastAutoVerify.toLocaleTimeString()}</small>}
    </section>
    <section style={{padding:16,border:"1px solid #ddd",borderRadius:14,marginBottom:24}}>
      <b>⏱ Automatic five-day clearance</b>
      <p>After delivery, buyers have a review window equal to the package's delivery time (e.g. 1-day delivery = 24 hours, 30-day delivery = 30 days) to open a dispute or request a revision. Once that window passes with no dispute, the order enters the standard five-day clearance period; when that ends, USDT/USDC seller earnings are released less the 5% withdrawal fee.</p>
      <label>Check every <input type="number" min={5} max={300} value={auto} onChange={ev=>setAuto(Math.max(5,Number(ev.target.value)||10))} style={{width:70,margin:"0 6px"}}/> seconds.</label>
      <button onClick={()=>void runClearance()} style={{marginLeft:10}}>Run now</button>
      {lastRun&&<small style={{marginLeft:10}}>Last check: {lastRun.toLocaleTimeString()}</small>}
    </section>
    {e&&<p style={{color:"#b00020"}}>{e}</p>}
    <h2>🎫 Listing credit payments — awaiting BingX verification ({pendingListing.length})</h2>
    {pendingListing.length?pendingListing.map(x=>listingCard(x,true)):<p>No listing credit payments awaiting verification.</p>}
    <h2>📜 Listing credit payment history ({listingHistory.length})</h2>
    {listingHistory.length?listingHistory.map(x=>listingCard(x,false)):<p>No processed listing credit payments yet.</p>}
    <h2>🛒 Pending service payments ({pending.length})</h2>
    {pending.length?pending.map(card):<p>No pending service payments.</p>}
    <h2>⚡ Approved — awaiting five-day clearance ({clearance.length})</h2>
    {clearance.length?clearance.map(card):<p>No approved service payments awaiting clearance.</p>}
    <h2>📜 Crypto transaction history ({history.length})</h2>
    {history.length?history.map(card):<p>No completed or rejected crypto transactions yet.</p>}
  </main>;
}
