import type {Metadata} from "next";
import Link from "next/link";
import {notFound} from "next/navigation";
import {db} from "@/lib/firebase-admin";
import {countryFlagUrl,resolveCountryCode} from "@/lib/country";
import styles from "./seller.module.css";

type Params={slug:string;id:string};
type PublicSeller={id:string;name:string;country:string;countryCode:string;image:string;joinedAt:Date|null;kycVerified:boolean;online:boolean;services:Array<Record<string,unknown>>};
const ONLINE_WINDOW_MS=5*60*1000;

const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const asDate=(value:unknown)=>value&&typeof value==="object"&&"toDate" in value&&typeof (value as {toDate?:unknown}).toDate==="function"?(value as {toDate:()=>Date}).toDate():value instanceof Date?value:null;

async function getSeller(id:string):Promise<PublicSeller|null>{
  const profileSnap=await db.collection("users").doc(id).get();
  if(!profileSnap.exists)return null;
  const profile=profileSnap.data()||{};
  const name=[profile.firstName,profile.lastName].map(value=>String(value||"").trim()).filter(Boolean).join(" "),country=String(profile.country||profile.countryName||"").trim(),countryCode=resolveCountryCode(country,profile.countryCode||profile.countryISO||profile.countryIso||profile.country_code);
  if(!name||!country)return null;
  const listingSnap=await db.collection("listings").where("sellerId","==",id).limit(100).get();
  const services=listingSnap.docs.filter(doc=>doc.data().status==="active").map(doc=>({id:doc.id,...doc.data()}));
  const lastActiveAt=asDate(profile.lastActiveAt),online=Boolean(lastActiveAt&&Date.now()-lastActiveAt.getTime()<ONLINE_WINDOW_MS);
  return {id,name,country,countryCode,image:String(profile.profileImageUrl||""),joinedAt:asDate(profile.joinedAt),kycVerified:profile.kycStatus==="approved",online,services};
}

export async function generateMetadata({params}:{params:Promise<Params>}):Promise<Metadata>{
  const {id}=await params;const seller=await getSeller(id);
  if(!seller)return {title:"Seller not found | SaharaSnow"};
  const title=`${seller.name} | SaharaSnow seller`,description=`View ${seller.name}'s services on SaharaSnow.`,image=seller.image||"/logo.png";
  return {title,description,openGraph:{title,description,type:"website",images:[{url:image}]},twitter:{card:"summary",title,description,images:[image]}};
}

export default async function SellerPage({params}:{params:Promise<Params>}){
  const {id}=await params;const seller=await getSeller(id);if(!seller)notFound();const flag=countryFlagUrl(seller.countryCode,48);
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" className={styles.brand}><img src="/logo.png" alt="SaharaSnow"/><span>SaharaSnow</span></Link><Link href="/#explore">← Browse services</Link></header>
    <section className={styles.profile}>
      {seller.image?<img className={styles.avatar} src={seller.image} alt={seller.name}/>:<div className={styles.avatarFallback}>{seller.name[0]}</div>}
      <div><p className={styles.eyebrow}>SELLER PROFILE</p><h1>{seller.name}</h1><p className={seller.online?"statusOnline":"statusAway"} style={{fontSize:13,margin:"2px 0 8px"}}>{seller.online?"Online":"Away"}</p><p className={styles.meta} style={{display:"flex",alignItems:"center",gap:6}}>{flag&&<img src={flag} alt="" aria-hidden="true" width={24} height={18} style={{width:24,height:18,objectFit:"cover",borderRadius:2,boxShadow:"0 0 0 1px rgba(0,0,0,.08)"}}/>}<span>{seller.country||"Country not provided"}{seller.joinedAt?` · Joined ${seller.joinedAt.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}`:""}</span></p>{seller.kycVerified&&<span className={styles.verified}>✓ KYC verified</span>}</div>
    </section>
    <section className={styles.services}><h2>Services by {seller.name}</h2>{seller.services.length?<div className={styles.grid}>{seller.services.map(service=>{const title=String(service.title||"Service");const subcategory=String(service.subcategory||service.category||"service");const image=Array.isArray(service.photoUrls)&&service.photoUrls[0]?String(service.photoUrls[0]):"";return <Link className={styles.card} key={String(service.id)} href={`/service/${slugify(`${subcategory}-by-${seller.name}`)}/${service.id}`}><div className={styles.image}>{image?<img src={image} alt={title}/>:<span>Service image</span>}</div><div className={styles.body}><small>{subcategory}</small><h3>{title}</h3><strong>From ${((Math.max(500,Number(service.priceCents||0)))/100).toFixed(2)}</strong></div></Link>})}</div>:<div className={styles.empty}>This seller has no published services yet.</div>}</section>
  </main>;
}
