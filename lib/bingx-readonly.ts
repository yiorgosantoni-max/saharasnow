import crypto from "node:crypto";

const BASE_URL=process.env.BINGX_BASE_URL||"https://open-api.bingx.com";
const API_KEY=process.env.BINGX_API_KEY;
const SECRET_KEY=process.env.BINGX_SECRET_KEY;

export type BingXDeposit={amount?:string|number;coin?:string;status?:string|number;txId?:string;insertTime?:number;network?:string;address?:string;[key:string]:unknown};
function requireCredentials(){if(!API_KEY||!SECRET_KEY)throw new Error("BingX read-only credentials are not configured.");}
export async function bingxGetDeposits(coin:"USDT"|"USDC",startTime:number,endTime:number):Promise<BingXDeposit[]>{
 requireCredentials();
 const params:Record<string,string>={coin,startTime:String(startTime),endTime:String(endTime),limit:"1000",recvWindow:"60000",timestamp:String(Date.now())};
 const query=new URLSearchParams(Object.entries(params).sort(([a],[b])=>a.localeCompare(b))).toString();
 const signature=crypto.createHmac("sha256",SECRET_KEY).update(query).digest("hex");
 const response=await fetch(`${BASE_URL}/openApi/api/v3/capital/deposit/hisrec?${query}&signature=${signature}`,{headers:{"X-BX-APIKEY":API_KEY,"X-SOURCE-KEY":"SAHARASNOW"},cache:"no-store"});
 if(!response.ok)throw new Error(`BingX deposit API returned HTTP ${response.status}.`);
 const payload=await response.json() as {code?:number;msg?:string;data?:BingXDeposit[]};
 if(payload.code!==undefined&&payload.code!==0)throw new Error(payload.msg||"BingX deposit API request failed.");
 return Array.isArray(payload.data)?payload.data:[];
}
export async function findBingXDepositByHash(txHash:string,coins:Array<"USDT"|"USDC">=["USDT","USDC"]){
 const normalized=txHash.trim().toLowerCase();if(!normalized||normalized.length<20)return null;
 const end=Date.now(),start=end-30*24*60*60*1000;
 for(const coin of coins){const deposits=await bingxGetDeposits(coin,start,end);const match=deposits.find(d=>String(d.txId||"").trim().toLowerCase()===normalized);if(match)return {...match,coin};}
 return null;
}
