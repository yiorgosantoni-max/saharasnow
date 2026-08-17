"use client";

import {useEffect} from "react";

export default function AdminError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("SaharaSnow admin error",error);},[error]);
  return <main style={{maxWidth:760,margin:"80px auto",padding:24,fontFamily:"Arial,sans-serif"}}><h1>Admin dashboard could not load</h1><p>Something went wrong while loading the secure administrator dashboard.</p><details style={{margin:"20px 0"}}><summary>Technical details</summary><pre style={{whiteSpace:"pre-wrap",marginTop:12}}>{error?.message||"Unknown client error"}{error?.digest?`\nDigest: ${error.digest}`:""}</pre></details><button type="button" onClick={()=>reset()} style={{padding:"11px 16px",border:0,borderRadius:10,cursor:"pointer"}}>Try again</button></main>;
}
