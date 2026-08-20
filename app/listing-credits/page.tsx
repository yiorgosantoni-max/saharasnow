"use client";
import {useEffect,useState} from "react";
import "./listing-credits.css";
import {getClientAuth} from "@/lib/firebase-client";

type Payment={paymentId:string;listingId:string;amount:number;credits:number;currency:string;network:string;depositAddress:string;qrCodeUrl:string};

export default function ListingCreditsPage(){
 const [listingId,setListingId]=useState("");
 const [method,setMethod]=useState<"usdt"|"usdc">("usdt");
 const [payment,setPayment]=useState<Payment|null>(null);
 const [txHash,setTxHash]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [done,setDone]=useState(false);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get("listing")||"";setListingId(id)},[]);
 const token=async()=>{const auth=getClientAuth();if(!auth.currentUser)throw new Error("Please sign in before paying for listing credits.");return auth.currentUser.getIdToken(true)};
 async function startPayment(nextMethod:typeof method){setMethod(nextMethod);setBusy(true);setNotice("");try{const authToken=await token();const res=await fetch("/api/crypto/listing-credits",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${authToken}`},body:JSON.stringify({listingId,paymentMethod:nextMethod})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Unable to create the crypto payment.");setPayment(data)}catch(e){setNotice(e instanceof Error?e.message:"Unable to create the crypto payment.")}finally{setBusy(false)}}
 async function submitHash(){if(!payment)return;if(txHash.trim().length<16){setNotice("Enter the blockchain transaction hash after sending the payment.");return}setBusy(true);setNotice("");try{const authToken=await token();const res=await fetch("/api/crypto/listing-credits",{method:"PUT",headers:{"content-type":"application/json",authorization:`Bearer ${authToken}`},body:JSON.stringify({paymentId:payment.paymentId,txHash:txHash.trim()})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Unable to submit the payment.");setDone(true);setNotice("Payment submitted. Your listing credits are being verified and the covered services are queued for approval.")}catch(e){setNotice(e instanceof Error?e.message:"Unable to submit the payment.")}finally{setBusy(false)}}
 return <main className="listingCreditsPage"><section className="listingCreditsCard">
  <div className="listingCreditsHero"><span>🚀 SELLER LISTING CREDITS</span><h1>Unlock 5 more listings</h1><p>After your 3 free listings, pay <strong>2 USDT</strong> or <strong>2 USDC</strong> to unlock a pack of 5 listing slots.</p></div>
  {done?<div className="listingCreditsDone"><div>✓</div><h2>Payment submitted</h2><p>{notice}</p><button className="listingCreditsButton" onClick={()=>window.location.assign("/?services=1")}>Return to seller dashboard</button></div>:<>
   <div className="listingCreditsPrice"><strong>2</strong><span>{method.toUpperCase()}</span><small>5 additional listings</small></div>
   <div className="listingCreditsMethods"><button className={method==="usdt"?"selected":""} onClick={()=>startPayment("usdt")} disabled={busy}>₮ USDT <small>TRC20</small></button><button className={method==="usdc"?"selected":""} onClick={()=>startPayment("usdc")} disabled={busy}>$ USDC <small>BEP20</small></button></div>
   {payment&&<div className="listingCreditsPayment"><div><h3>Send exactly {payment.amount} {payment.currency}</h3><p>Network: <strong>{payment.network}</strong></p><img src={payment.qrCodeUrl} alt={`${payment.currency} payment QR code`}/><label>Deposit address<input readOnly value={payment.depositAddress} onFocus={e=>e.currentTarget.select()}/></label></div><div className="listingCreditsConfirm"><label>Transaction hash<input value={txHash} onChange={e=>setTxHash(e.target.value)} placeholder="Paste your blockchain transaction hash"/></label><button className="listingCreditsButton" onClick={submitHash} disabled={busy}>{busy?"Submitting…":"I sent the payment →"}</button></div></div>}
   {!payment&&<button className="listingCreditsButton" onClick={()=>startPayment(method)} disabled={busy}>{busy?"Preparing…":`Pay 2 ${method.toUpperCase()} →`}</button>}
   {notice&&<p className="listingCreditsNotice">{notice}</p>}
  </>}
  <p className="listingCreditsFine">🔐 Crypto payment only · 2 USDT or 2 USDC · 5 listings · Payment is verified before final approval.</p>
 </section></main>
}
