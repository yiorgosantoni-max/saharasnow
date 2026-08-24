"use client";
import {useEffect,useMemo,useState} from "react";
import {getClientAuth} from "@/lib/firebase-client";
import {countryFlagUrl,resolveCountryCode} from "@/lib/country";

type Review={id:string;rating:number;text:string;verifiedPurchase?:boolean;orderNumber?:string;buyerId?:string;createdAt?:{_seconds?:number};buyerName?:string;buyerFirstName?:string;buyerLastName?:string;buyerProfileImageUrl?:string;buyerCountry?:string;buyerCountryCode?:string;sellerReply?:string;sellerReplyName?:string;sellerReplyImageUrl?:string;sellerReplyEdited?:boolean};
type Tip={id:string;amountCents:number;currency:string;network:string;depositAddress:string;qrCodeUrl:string;status:string};
const PER_PAGE=10;
function initials(r:Review){return ((r.buyerFirstName||r.buyerName||"S").trim()[0]||"S").toUpperCase();}
function CountryFlag({country,code}:{country?:string;code?:string}){const src=countryFlagUrl(resolveCountryCode(country,code),40);return src?<img src={src} alt="" aria-hidden="true" width={20} height={15} style={{width:20,height:15,objectFit:"cover",borderRadius:2,verticalAlign:"-2px",boxShadow:"0 0 0 1px rgba(0,0,0,.08)"}}/>:null;}
const btn:React.CSSProperties={padding:"9px 14px",borderRadius:9,border:"1px solid #d9d3ea",background:"#fff",fontWeight:700,fontSize:13,cursor:"pointer"};
const primaryBtn:React.CSSProperties={...btn,border:0,background:"#17134f",color:"#fff"};

export default function ReviewSection({sellerId}:{sellerId:string}){
 const [reviews,setReviews]=useState<Review[]>([]);
 const [summary,setSummary]=useState({count:0,average:0});
 const [eligibleOrderIds,setEligibleOrderIds]=useState<string[]>([]);
 const [isSeller,setIsSeller]=useState(false);
 const [viewerId,setViewerId]=useState("");
 const [loading,setLoading]=useState(true);
 const [page,setPage]=useState(1);
 const [replyOpen,setReplyOpen]=useState("");
 const [replyText,setReplyText]=useState("");
 const [replyBusy,setReplyBusy]=useState(false);
 const [replyError,setReplyError]=useState("");
 const [tipOpen,setTipOpen]=useState("");
 const [tipAmount,setTipAmount]=useState("5.00");
 const [tipCurrency,setTipCurrency]=useState<"USDT"|"USDC">("USDT");
 const [tipBusy,setTipBusy]=useState(false);
 const [tipError,setTipError]=useState("");
 const [tip,setTip]=useState<Tip|null>(null);
 const [txHash,setTxHash]=useState("");
 const [tipDone,setTipDone]=useState("");

 const load=async()=>{
  try{
   const auth=getClientAuth();await auth.authStateReady();const user=auth.currentUser;
   setViewerId(user?.uid||"");
   const headers:Record<string,string>={};if(user)headers.authorization=`Bearer ${await user.getIdToken()}`;
   const r=await fetch(`/api/reviews?sellerId=${encodeURIComponent(sellerId)}`,{headers,cache:"no-store"});
   const d=await r.json();
   setReviews(Array.isArray(d.reviews)?d.reviews:[]);
   setSummary(d.summary||{count:0,average:0});
   setEligibleOrderIds(Array.isArray(d.eligibleOrderIds)?d.eligibleOrderIds:[]);
   setIsSeller(Boolean(d.isSeller));
  }catch{}finally{setLoading(false)}
 };
 useEffect(()=>{void load()},[sellerId]);

 const totalPages=Math.max(1,Math.ceil(reviews.length/PER_PAGE));
 const safePage=Math.min(page,totalPages);
 const pageReviews=useMemo(()=>reviews.slice((safePage-1)*PER_PAGE,safePage*PER_PAGE),[reviews,safePage]);

 const submitReply=async(reviewId:string)=>{
  setReplyError("");
  if(replyText.trim().length<2){setReplyError("Write a short reply before posting.");return}
  setReplyBusy(true);
  try{
   const user=getClientAuth().currentUser;
   if(!user)throw new Error("Please sign in again.");
   const token=await user.getIdToken(true);
   const r=await fetch("/api/reviews",{method:"PATCH",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({reviewId,text:replyText.trim()})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||"Unable to post your reply.");
   setReplyOpen("");setReplyText("");
   await load();
  }catch(e){setReplyError(e instanceof Error?e.message:"Unable to post your reply.")}
  finally{setReplyBusy(false)}
 };

 const startTip=async(reviewId:string)=>{
  setTipError("");
  const cents=Math.round(Number(tipAmount)*100);
  if(!Number.isFinite(cents)||cents<100){setTipError("Enter a tip of at least $1.00.");return}
  setTipBusy(true);
  try{
   const user=getClientAuth().currentUser;
   if(!user)throw new Error("Please sign in again.");
   const token=await user.getIdToken(true);
   const r=await fetch("/api/tips",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({reviewId,amountCents:cents,currency:tipCurrency})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||"Unable to prepare the tip.");
   setTip(d);setTxHash("");
  }catch(e){setTipError(e instanceof Error?e.message:"Unable to prepare the tip.")}
  finally{setTipBusy(false)}
 };

 const submitTip=async()=>{
  setTipError("");
  if(txHash.trim().length<16){setTipError("Paste the blockchain transaction hash after sending.");return}
  setTipBusy(true);
  try{
   const user=getClientAuth().currentUser;
   if(!user)throw new Error("Please sign in again.");
   const token=await user.getIdToken(true);
   const r=await fetch("/api/tips",{method:"PUT",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({tipId:tip!.id,txHash:txHash.trim()})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||"Unable to submit the tip.");
   setTipDone(tipOpen);setTip(null);setTipOpen("");setTxHash("");
  }catch(e){setTipError(e instanceof Error?e.message:"Unable to submit the tip.")}
  finally{setTipBusy(false)}
 };

 const closeTip=()=>{setTipOpen("");setTip(null);setTipError("");setTxHash("")};
 const stars=(n:number)=>"★★★★★".slice(0,Math.max(0,Math.min(5,n)))+"☆☆☆☆☆".slice(0,5-Math.max(0,Math.min(5,n)));

 return <section style={{marginTop:32,paddingTop:28,borderTop:"1px solid #e7e2da"}}>
  <div style={{display:"flex",alignItems:"end",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
   <div><small style={{letterSpacing:".12em",fontWeight:700,color:"#777"}}>SELLER REVIEWS</small><h2 style={{margin:"6px 0 4px"}}>Reviews &amp; rating</h2></div>
   <div style={{textAlign:"right"}}><strong style={{fontSize:28}}>{summary.average.toFixed(1)}</strong><div style={{letterSpacing:2}}>{stars(Math.round(summary.average))}</div><small>{summary.count} {summary.count===1?"review":"reviews"}</small></div>
  </div>

  {eligibleOrderIds.length>0&&<div style={{marginTop:18,padding:16,borderRadius:14,background:"#f7f5ff",border:"1px solid #e5e0ff"}}>
   <b>Share your experience</b>
   <p style={{margin:"6px 0 12px",color:"#666"}}>You have a completed order with this seller. Your verified rating helps other buyers.</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{eligibleOrderIds.map(id=><a key={id} href={`/review/${encodeURIComponent(id)}`} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"10px 15px",borderRadius:10,background:"#17134f",color:"#fff",fontWeight:700,textDecoration:"none"}}>★ Leave a review</a>)}</div>
  </div>}

  {loading?<p>Loading reviews…</p>:reviews.length===0?<p style={{color:"#777"}}>No reviews yet. Completed buyers can leave the first verified review.</p>:<>
  <div style={{display:"grid",gap:14,marginTop:18}}>
   {pageReviews.map(r=><article key={r.id} style={{padding:"16px 18px",border:"1px solid #e7e2da",borderRadius:14}}>
    <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
     {r.buyerProfileImageUrl?<img src={r.buyerProfileImageUrl} alt={r.buyerName||"Reviewer"} style={{width:42,height:42,borderRadius:"50%",objectFit:"cover",border:"1px solid #e7e2da"}}/>:<div aria-label="Reviewer avatar" style={{width:42,height:42,borderRadius:"50%",display:"grid",placeItems:"center",fontWeight:800,background:"#f2efe9"}}>{initials(r)}</div>}
     <div style={{minWidth:0}}><b>{r.buyerName||"Verified buyer"}</b><div style={{fontSize:13,color:"#777",marginTop:2,display:"flex",alignItems:"center",gap:5}}>{r.buyerCountry?<><CountryFlag country={r.buyerCountry} code={r.buyerCountryCode}/><span>{r.buyerCountry}</span></>:<span>Verified buyer</span>}</div></div>
    </div>
    <div><b style={{letterSpacing:1}}>{stars(r.rating)}</b>{r.verifiedPurchase&&<span style={{marginLeft:10,fontSize:12,fontWeight:700}}>✓ Verified purchase</span>}{r.orderNumber&&<span style={{marginLeft:10,fontSize:12,color:"#999"}}>Order #{r.orderNumber}</span>}</div>
    <p style={{margin:"10px 0 0",lineHeight:1.55}}>{r.text}</p>

    {r.sellerReply&&<div style={{marginTop:14,marginLeft:18,borderLeft:"3px solid #d9d3ea",background:"#faf9fd",borderRadius:"0 10px 10px 0",padding:"12px 14px"}}>
     <div style={{display:"flex",gap:9,alignItems:"center",marginBottom:6}}>
      {r.sellerReplyImageUrl?<img src={r.sellerReplyImageUrl} alt={r.sellerReplyName||"Seller"} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover",border:"1px solid #e7e2da"}}/>:<div style={{width:30,height:30,borderRadius:"50%",display:"grid",placeItems:"center",background:"#ece7f7",fontSize:14}}>💬</div>}
      <div><b style={{fontSize:13}}>{r.sellerReplyName||"Seller"}</b><small style={{display:"block",fontSize:11,color:"#8a86a0"}}>Seller response to order #{r.orderNumber||r.id}{r.sellerReplyEdited?" · edited":""}</small></div>
     </div>
     <p style={{margin:0,lineHeight:1.55,fontSize:14}}>{r.sellerReply}</p>
    </div>}

    {isSeller&&(replyOpen===r.id?<div style={{marginTop:12,marginLeft:18}}>
     <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={3} maxLength={1000} placeholder={`Reply publicly to this review of order #${r.orderNumber||r.id}…`} style={{width:"100%",padding:10,borderRadius:10,border:"1px solid #ddd",fontFamily:"inherit",fontSize:14}}/>
     {replyError&&<p style={{margin:"6px 0 0",color:"#b42318",fontSize:13,fontWeight:600}}>{replyError}</p>}
     <div style={{display:"flex",gap:8,marginTop:8}}><button type="button" onClick={()=>{setReplyOpen("");setReplyText("");setReplyError("")}} style={btn}>Cancel</button><button type="button" disabled={replyBusy} onClick={()=>void submitReply(r.id)} style={primaryBtn}>{replyBusy?"Posting…":"Post reply"}</button></div>
    </div>:<button type="button" onClick={()=>{setReplyOpen(r.id);setReplyText(r.sellerReply||"");setReplyError("")}} style={{...btn,marginTop:12,marginLeft:18}}>{r.sellerReply?"✎ Edit your reply":"💬 Reply to this review"}</button>)}

    {viewerId&&viewerId===r.buyerId&&(tipDone===r.id?<p style={{marginTop:12,marginLeft:18,padding:"10px 13px",borderRadius:10,background:"#eefaf2",color:"#18794e",fontSize:13,fontWeight:600}}>✓ Tip submitted for verification. The seller is credited once the payment is confirmed.</p>:tipOpen===r.id?<div style={{marginTop:12,marginLeft:18,padding:14,borderRadius:12,background:"#fffaf2",border:"1px solid #f0e2c8"}}>
     {!tip?<>
      <b style={{fontSize:14}}>Send a tip for order #{r.orderNumber||r.id}</b>
      <p style={{margin:"5px 0 10px",fontSize:13,color:"#7a6a4a"}}>Optional. The full amount goes to the seller once your payment is verified.</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
       <label style={{fontSize:12,fontWeight:700}}>Amount ($)<input value={tipAmount} onChange={e=>setTipAmount(e.target.value)} inputMode="decimal" style={{display:"block",marginTop:4,padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",width:110,fontSize:14}}/></label>
       <label style={{fontSize:12,fontWeight:700}}>Currency<select value={tipCurrency} onChange={e=>setTipCurrency(e.target.value as "USDT"|"USDC")} style={{display:"block",marginTop:4,padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:14}}><option value="USDT">USDT</option><option value="USDC">USDC</option></select></label>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{["3.00","5.00","10.00","25.00"].map(v=><button key={v} type="button" onClick={()=>setTipAmount(v)} style={{...btn,padding:"6px 11px",fontSize:12,border:tipAmount===v?"1px solid #17134f":"1px solid #e0d8c8"}}>${v}</button>)}</div>
      {tipError&&<p style={{margin:"8px 0 0",color:"#b42318",fontSize:13,fontWeight:600}}>{tipError}</p>}
      <div style={{display:"flex",gap:8,marginTop:11}}><button type="button" onClick={closeTip} style={btn}>Cancel</button><button type="button" disabled={tipBusy} onClick={()=>void startTip(r.id)} style={primaryBtn}>{tipBusy?"Preparing…":"Continue →"}</button></div>
     </>:<>
      <b style={{fontSize:14}}>Send exactly {(tip.amountCents/100).toFixed(2)} {tip.currency}</b>
      <p style={{margin:"5px 0 10px",fontSize:13,color:"#7a6a4a"}}>Network: <b>{tip.network}</b></p>
      <img src={tip.qrCodeUrl} alt={`${tip.currency} tip QR code`} style={{width:"min(180px,50vw)",height:"auto",background:"#fff",padding:9,borderRadius:14,display:"block"}}/>
      <label style={{fontSize:12,fontWeight:700,display:"block",marginTop:10}}>Deposit address<input readOnly value={tip.depositAddress} onFocus={e=>e.currentTarget.select()} style={{display:"block",marginTop:4,width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontFamily:"ui-monospace,Menlo,monospace",fontSize:12}}/></label>
      <label style={{fontSize:12,fontWeight:700,display:"block",marginTop:10}}>Transaction hash<input value={txHash} onChange={e=>setTxHash(e.target.value)} placeholder="Paste after sending" style={{display:"block",marginTop:4,width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid #ddd",fontSize:13}}/></label>
      <div style={{marginTop:9,padding:"9px 11px",borderRadius:9,background:"#fff3e0",color:"#7a5712",fontSize:12,lineHeight:1.45}}>⚠️ Send <b>{tip.currency} only on {tip.network}</b>. Verify the address before sending.</div>
      {tipError&&<p style={{margin:"8px 0 0",color:"#b42318",fontSize:13,fontWeight:600}}>{tipError}</p>}
      <div style={{display:"flex",gap:8,marginTop:11}}><button type="button" onClick={closeTip} style={btn}>Cancel</button><button type="button" disabled={tipBusy} onClick={()=>void submitTip()} style={primaryBtn}>{tipBusy?"Submitting…":"I sent the tip"}</button></div>
     </>}
    </div>:<button type="button" onClick={()=>{setTipOpen(r.id);setTipError("");setTip(null)}} style={{...btn,marginTop:12,marginLeft:18,border:"1px solid #f0d8a8",background:"#fffaf2"}}>💛 Leave a tip</button>)}
   </article>)}
  </div>

  {totalPages>1&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginTop:20}}>
   <button type="button" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={{...btn,opacity:safePage<=1?.45:1,cursor:safePage<=1?"default":"pointer"}}>← Previous</button>
   <span style={{fontSize:13,color:"#777"}}>Page {safePage} of {totalPages}</span>
   <button type="button" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} style={{...btn,opacity:safePage>=totalPages?.45:1,cursor:safePage>=totalPages?"default":"pointer"}}>Next →</button>
  </div>}
  </>}
 </section>;
}
